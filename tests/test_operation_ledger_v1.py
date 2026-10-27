from datetime import datetime, timezone
from pathlib import Path
import sqlite3, tempfile, unittest
from control_plane.operation_ledger_v1 import ChainIntegrityError, IdempotencyConflict, LedgerError, OperationLedger

def event(**overrides):
    result={"event_id":"event-1","request_id":"request-1","evidence_id":"evidence-1","decision":"ACCEPTED",
      "repository":"org/service","revision":"a"*40,"artifact_sha256":"b"*64,"policy_id":"production-release",
      "policy_version":"1.0.0","verifier_code":"EVIDENCE_ACCEPTED"}
    result.update(overrides); return result

class OperationLedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.db=Path(self.temp.name)/"ledger.sqlite3"
        self.ledger=OperationLedger(self.db); self.time=datetime(2026,10,27,12,30,tzinfo=timezone.utc)
    def tearDown(self): self.temp.cleanup()
    def test_appends_and_verifies_chain(self):
        r=self.ledger.append_decision(event(),created_at=self.time)
        self.assertEqual(r.sequence,1); self.assertEqual(self.ledger.verify_chain()["event_count"],1)
    def test_idempotent_retry_returns_original_receipt(self):
        a=self.ledger.append_decision(event(),created_at=self.time); b=self.ledger.append_decision(event(),created_at=self.time)
        self.assertEqual(a,b); self.assertEqual(self.ledger.verify_chain()["event_count"],1)
    def test_conflicting_retry_rejected(self):
        self.ledger.append_decision(event(),created_at=self.time)
        with self.assertRaises(IdempotencyConflict): self.ledger.append_decision(event(decision="REJECTED"),created_at=self.time)
    def test_second_event_links_to_first(self):
        a=self.ledger.append_decision(event(),created_at=self.time)
        b=self.ledger.append_decision(event(event_id="event-2",request_id="request-2",evidence_id="evidence-2"),created_at=self.time)
        self.assertEqual(b.previous_hash,a.event_hash); self.assertEqual(self.ledger.verify_chain()["event_count"],2)
    def test_rejects_unknown_fields(self):
        with self.assertRaises(LedgerError): self.ledger.append_decision(event(extra="no"),created_at=self.time)
    def test_rejects_short_revision(self):
        with self.assertRaises(LedgerError): self.ledger.append_decision(event(revision="abc"),created_at=self.time)
    def test_rejects_invalid_digest(self):
        with self.assertRaises(LedgerError): self.ledger.append_decision(event(artifact_sha256="z"*64),created_at=self.time)
    def test_rejects_naive_timestamp(self):
        with self.assertRaises(LedgerError): self.ledger.append_decision(event(),created_at=datetime(2026,10,27))
    def test_supports_rejected_decision(self):
        self.assertEqual(self.ledger.append_decision(event(decision="REJECTED"),created_at=self.time).decision,"REJECTED")
    def test_query_by_request(self):
        self.ledger.append_decision(event(),created_at=self.time)
        self.assertEqual(len(self.ledger.get_by_request("request-1")),1); self.assertEqual(self.ledger.get_by_request("absent"),[])
    def test_detects_tampered_event(self):
        self.ledger.append_decision(event(),created_at=self.time)
        with sqlite3.connect(self.db) as c: c.execute("UPDATE operation_ledger SET event_json=? WHERE sequence=1",('{"decision":"ACCEPTED"}',))
        with self.assertRaises(ChainIntegrityError): self.ledger.verify_chain()
    def test_detects_tampered_link(self):
        self.ledger.append_decision(event(),created_at=self.time)
        self.ledger.append_decision(event(event_id="event-2",request_id="request-2",evidence_id="evidence-2"),created_at=self.time)
        with sqlite3.connect(self.db) as c: c.execute("UPDATE operation_ledger SET previous_hash=? WHERE sequence=2",("f"*64,))
        with self.assertRaises(ChainIntegrityError): self.ledger.verify_chain()
    def test_detects_index_mismatch(self):
        self.ledger.append_decision(event(),created_at=self.time)
        with sqlite3.connect(self.db) as c: c.execute("UPDATE operation_ledger SET request_id=? WHERE sequence=1",("other",))
        with self.assertRaises(ChainIntegrityError): self.ledger.verify_chain()

if __name__=="__main__": unittest.main()
