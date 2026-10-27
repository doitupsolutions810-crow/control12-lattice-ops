"""Append-only, hash-chained operation decision ledger (SQLite).

This records verifier decisions; it does not itself authenticate evidence.
Deployments must call it from a trusted service after running the evidence gate.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib, json, sqlite3
from pathlib import Path
from typing import Any, Mapping

GENESIS = "0" * 64

class LedgerError(RuntimeError): pass
class IdempotencyConflict(LedgerError): pass
class ChainIntegrityError(LedgerError): pass

def canonical_json(value: Any) -> str:
    """v1 profile: sorted keys, compact separators, ASCII escapes, no NaN."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

@dataclass(frozen=True)
class LedgerReceipt:
    sequence: int
    event_id: str
    request_id: str
    evidence_id: str
    decision: str
    previous_hash: str
    event_hash: str
    created_at: str
    def as_dict(self) -> dict[str, Any]:
        return {"sequence": self.sequence, "event_id": self.event_id, "request_id": self.request_id,
                "evidence_id": self.evidence_id, "decision": self.decision,
                "previous_hash": self.previous_hash, "event_hash": self.event_hash, "created_at": self.created_at}

class OperationLedger:
    """SQLite ledger with serialized appends, idempotency, and chain verification.

    SQLite serializes writers with BEGIN IMMEDIATE. Use a durable local filesystem,
    not an unreliable network filesystem. Multi-host production needs a shared
    transactional database with equivalent uniqueness and chain semantics.
    """
    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        if self.database_path != ":memory:":
            Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS operation_ledger (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                request_id TEXT NOT NULL,
                evidence_id TEXT NOT NULL,
                decision TEXT NOT NULL CHECK(decision IN ('ACCEPTED','REJECTED','NOT_VERIFIED')),
                event_json TEXT NOT NULL,
                previous_hash TEXT NOT NULL,
                event_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(request_id, evidence_id))""")
            conn.execute("CREATE INDEX IF NOT EXISTS ledger_request_idx ON operation_ledger(request_id)")

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.database_path, timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=10000")
        return conn

    @staticmethod
    def _validate_event(event: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(event, Mapping):
            raise LedgerError("event must be an object")
        required = {"event_id","request_id","evidence_id","decision","repository","revision",
                    "artifact_sha256","policy_id","policy_version","verifier_code"}
        if set(event.keys()) != required:
            raise LedgerError("event fields must exactly match the v1 ledger contract")
        for key in required - {"decision"}:
            if not isinstance(event.get(key), str) or not event[key].strip():
                raise LedgerError(f"{key} must be a non-empty string")
        if event["decision"] not in {"ACCEPTED","REJECTED","NOT_VERIFIED"}:
            raise LedgerError("decision must be ACCEPTED, REJECTED, or NOT_VERIFIED")
        if len(event["revision"]) != 40 or any(c not in "0123456789abcdef" for c in event["revision"]):
            raise LedgerError("revision must be a full lowercase 40-character Git SHA")
        if len(event["artifact_sha256"]) != 64 or any(c not in "0123456789abcdef" for c in event["artifact_sha256"]):
            raise LedgerError("artifact_sha256 must be lowercase SHA-256 hex")
        return dict(event)

    def append_decision(self, event: Mapping[str, Any], *, created_at: datetime | None = None) -> LedgerReceipt:
        body = self._validate_event(event)
        timestamp = created_at or datetime.now(timezone.utc)
        if timestamp.tzinfo is None or timestamp.utcoffset() is None:
            raise LedgerError("created_at must be timezone-aware")
        created = timestamp.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")
        event_json = canonical_json(body)
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                existing = conn.execute("SELECT * FROM operation_ledger WHERE request_id=? AND evidence_id=?",
                                        (body["request_id"],body["evidence_id"])).fetchone()
                if existing:
                    if existing["event_json"] != event_json:
                        raise IdempotencyConflict("request/evidence pair already exists with different content")
                    conn.execute("COMMIT")
                    return self._receipt(existing)
                prev = conn.execute("SELECT event_hash FROM operation_ledger ORDER BY sequence DESC LIMIT 1").fetchone()
                previous_hash = prev["event_hash"] if prev else GENESIS
                event_hash = _sha256(canonical_json({"event":body,"created_at":created,"previous_hash":previous_hash}))
                conn.execute("""INSERT INTO operation_ledger
                    (event_id,request_id,evidence_id,decision,event_json,previous_hash,event_hash,created_at)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (body["event_id"],body["request_id"],body["evidence_id"],body["decision"],event_json,previous_hash,event_hash,created))
                row = conn.execute("SELECT * FROM operation_ledger WHERE event_id=?",(body["event_id"],)).fetchone()
                conn.execute("COMMIT")
                return self._receipt(row)
            except Exception:
                if conn.in_transaction: conn.execute("ROLLBACK")
                raise

    @staticmethod
    def _receipt(row: sqlite3.Row) -> LedgerReceipt:
        return LedgerReceipt(row["sequence"],row["event_id"],row["request_id"],row["evidence_id"],
                             row["decision"],row["previous_hash"],row["event_hash"],row["created_at"])

    def verify_chain(self) -> dict[str, Any]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM operation_ledger ORDER BY sequence ASC").fetchall()
        expected_previous = GENESIS
        for expected_sequence,row in enumerate(rows,start=1):
            if row["sequence"] != expected_sequence:
                raise ChainIntegrityError(f"sequence gap at row {expected_sequence}")
            if row["previous_hash"] != expected_previous:
                raise ChainIntegrityError(f"previous hash mismatch at sequence {expected_sequence}")
            try: body = json.loads(row["event_json"])
            except json.JSONDecodeError as exc:
                raise ChainIntegrityError(f"invalid event JSON at sequence {expected_sequence}") from exc
            calculated = _sha256(canonical_json({"event":body,"created_at":row["created_at"],"previous_hash":row["previous_hash"]}))
            if calculated != row["event_hash"]:
                raise ChainIntegrityError(f"event hash mismatch at sequence {expected_sequence}")
            if any(body.get(k) != row[k] for k in ("event_id","request_id","evidence_id","decision")):
                raise ChainIntegrityError(f"indexed fields mismatch at sequence {expected_sequence}")
            expected_previous = row["event_hash"]
        return {"valid":True,"event_count":len(rows),"head_hash":expected_previous}

    def get_by_request(self, request_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM operation_ledger WHERE request_id=? ORDER BY sequence",(request_id,)).fetchall()
        return [self._receipt(row).as_dict() | {"event":json.loads(row["event_json"])} for row in rows]
