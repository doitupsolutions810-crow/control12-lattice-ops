"""Fail-closed acceptance gate for cross-repository execution evidence.

Cryptographic signature verification and durable replay storage are injected so
this module cannot accidentally trust a caller-provided boolean as a signature.
Production callers MUST provide an independently pinned signature verifier and
an atomic, durable ReplayGuard implementation.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any, Callable, Mapping, Protocol

SCHEMA = "control12.evidence-envelope/v1"
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_GIT_SHA = re.compile(r"^[0-9a-f]{40}$")


class ReplayGuard(Protocol):
    """Atomically record a unique evidence/request pair; return False on replay."""
    def consume_once(self, request_id: str, evidence_id: str) -> bool: ...


@dataclass(frozen=True)
class GateResult:
    accepted: bool
    code: str
    reason: str
    production_authorized: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {"accepted": self.accepted, "code": self.code, "reason": self.reason,
                "production_authorized": self.production_authorized}


def _fail(code: str, reason: str) -> GateResult:
    return GateResult(False, code, reason, False)


def _utc_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.endswith("Z"):
        return None
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed.astimezone(timezone.utc)


def evaluate_evidence(
    envelope: Mapping[str, Any], *, expected_repository: str,
    expected_revision: str, expected_artifact_sha256: str,
    expected_policy_id: str, expected_policy_version: str, now: datetime,
    max_age_seconds: int, signature_verifier: Callable[[Mapping[str, Any]], bool],
    replay_guard: ReplayGuard, allow_local_evidence: bool = False,
) -> GateResult:
    """Check evidence bindings; a separate gate must decide production authorization."""
    if not isinstance(envelope, Mapping):
        return _fail("INVALID_ENVELOPE", "Envelope must be an object.")
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        return _fail("INVALID_CLOCK", "Verifier clock must be timezone-aware.")
    if not isinstance(max_age_seconds, int) or isinstance(max_age_seconds, bool) or max_age_seconds <= 0:
        return _fail("INVALID_FRESHNESS_POLICY", "Maximum evidence age must be a positive integer.")

    required = {"schema", "evidence_id", "claim", "subject", "execution", "authority",
                "policy", "issued_at", "expires_at", "request_id", "signature"}
    if not required.issubset(envelope.keys()):
        return _fail("MISSING_FIELDS", "Envelope is missing required fields.")
    if envelope.get("schema") != SCHEMA:
        return _fail("UNSUPPORTED_SCHEMA", "Evidence schema is not supported.")
    for key in ("evidence_id", "request_id"):
        if not isinstance(envelope.get(key), str) or not envelope[key].strip():
            return _fail("INVALID_ID", f"{key} must be a non-empty string.")

    claim, subject, execution = envelope.get("claim"), envelope.get("subject"), envelope.get("execution")
    authority, policy, signature = envelope.get("authority"), envelope.get("policy"), envelope.get("signature")
    if not all(isinstance(x, Mapping) for x in (claim, subject, execution, authority, policy, signature)):
        return _fail("INVALID_SHAPE", "Claim, subject, execution, authority, policy and signature must be objects.")
    allowed_top = required
    if set(envelope.keys()) != allowed_top:
        return _fail("UNKNOWN_FIELDS", "Envelope contains fields outside the v1 contract.")
    allowed_nested = (
        (claim, {"status", "summary"}),
        (subject, {"repository", "revision", "artifact_sha256"}),
        (execution, {"mode", "worker_receipt_id", "local"}),
        (authority, {"issuer", "key_id"}),
        (policy, {"id", "version"}),
        (signature, {"algorithm", "value"}),
    )
    if any(set(obj.keys()) != allowed for obj, allowed in allowed_nested):
        return _fail("UNKNOWN_FIELDS", "A nested object contains fields outside the v1 contract.")
    if claim.get("status") != "PASS":
        return _fail("CLAIM_NOT_PASS", "Only an explicit PASS claim can be accepted.")
    if subject.get("repository") != expected_repository:
        return _fail("SUBJECT_MISMATCH", "Repository does not match the expected subject.")
    revision = subject.get("revision")
    if not isinstance(revision, str) or not _GIT_SHA.fullmatch(revision) or revision != expected_revision:
        return _fail("REVISION_MISMATCH", "A full, expected 40-character source revision is required.")
    digest = subject.get("artifact_sha256")
    if not isinstance(digest, str) or not _SHA256.fullmatch(digest):
        return _fail("INVALID_ARTIFACT_DIGEST", "Artifact digest must be lowercase SHA-256 hex.")
    if not isinstance(expected_artifact_sha256, str) or not _SHA256.fullmatch(expected_artifact_sha256) or digest != expected_artifact_sha256:
        return _fail("ARTIFACT_MISMATCH", "Artifact digest does not match the expected immutable artifact.")

    mode = execution.get("mode")
    if mode == "simulation":
        return _fail("SIMULATION_DENIED", "Simulation evidence cannot satisfy real-execution acceptance.")
    if mode != "real":
        return _fail("EXECUTION_MODE_UNKNOWN", "Execution mode must be explicitly real.")
    if not isinstance(execution.get("worker_receipt_id"), str) or not execution["worker_receipt_id"].strip():
        return _fail("MISSING_WORKER_RECEIPT", "Real execution requires a worker receipt identifier.")
    if execution.get("local") is True and not allow_local_evidence:
        return _fail("LOCAL_EVIDENCE_DENIED", "Local evidence is not accepted by this policy.")
    if policy.get("id") != expected_policy_id or policy.get("version") != expected_policy_version:
        return _fail("POLICY_MISMATCH", "Evidence policy identity/version does not match the expected policy.")
    if not all(isinstance(authority.get(k), str) and authority[k].strip() for k in ("issuer", "key_id")):
        return _fail("INVALID_AUTHORITY", "Authority issuer and key ID are required.")
    if signature.get("algorithm") != "Ed25519" or not isinstance(signature.get("value"), str) or not signature["value"].strip():
        return _fail("INVALID_SIGNATURE_SHAPE", "A non-empty Ed25519 signature is required.")

    issued, expires = _utc_timestamp(envelope.get("issued_at")), _utc_timestamp(envelope.get("expires_at"))
    current = now.astimezone(timezone.utc)
    if issued is None or expires is None or expires <= issued:
        return _fail("INVALID_TIMESTAMPS", "Timestamps must be valid UTC ISO-8601 and expiry must follow issue time.")
    if issued > current:
        return _fail("FUTURE_EVIDENCE", "Evidence issue time is in the future.")
    if current >= expires:
        return _fail("EXPIRED_EVIDENCE", "Evidence has expired.")
    if (current - issued).total_seconds() > max_age_seconds:
        return _fail("STALE_EVIDENCE", "Evidence exceeds the configured maximum age.")

    try:
        verified = signature_verifier(envelope)
    except Exception:
        verified = False
    if verified is not True:
        return _fail("SIGNATURE_UNVERIFIED", "Signature was not verified by the injected trusted-key verifier.")
    try:
        fresh = replay_guard.consume_once(envelope["request_id"], envelope["evidence_id"])
    except Exception:
        fresh = False
    if fresh is not True:
        return _fail("REPLAY_OR_REPLAY_STORE_FAILURE", "Evidence was replayed or the replay guard failed closed.")

    return GateResult(True, "EVIDENCE_ACCEPTED",
                      "Evidence passed this verifier's binding, signature, freshness and replay checks.", False)
