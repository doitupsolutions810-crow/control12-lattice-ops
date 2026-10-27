from datetime import datetime, timezone
from pathlib import Path
import sys, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from control_plane.evidence_gate_v1 import SCHEMA
from control_plane.operation_ledger_v1 import OperationLedger
from control_plane.governed_operation_v1 import verify_and_record

class Guard:
    def __init__(self): self.seen=set()
    def consume_once(self,r,e):
        pair=(r,e)
        if pair in self.seen:return False
        self.seen.add(pair);return True

def envelope():
    return {"schema":SCHEMA,"evidence_id":"ev-1","claim":{"status":"PASS","summary":"verified"},
    "subject":{"repository":"org/svc","revision":"a"*40,"artifact_sha256":"b"*64},
    "execution":{"mode":"real","worker_receipt_id":"receipt-1","local":False},
    "authority":{"issuer":"ci","key_id":"key-1"},"policy":{"id":"prod","version":"1"},
    "issued_at":"2026-10-27T12:00:00Z","expires_at":"2026-10-27T13:00:00Z",
    "request_id":"req-1","signature":{"algorithm":"Ed25519","value":"sig"}}

class CompositionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.ledger=OperationLedger(Path(self.temp.name)/"ledger.db")
        self.kw=dict(event_id="ledger-event-1",expected_repository="org/svc",expected_revision="a"*40,
        expected_artifact_sha256="b"*64,expected_policy_id="prod",expected_policy_version="1",
        now=datetime(2026,10,27,12,30,tzinfo=timezone.utc),max_age_seconds=3600,
        signature_verifier=lambda e:True,replay_guard=Guard(),ledger=self.ledger)
    def tearDown(self):self.temp.cleanup()
    def test_acceptance_is_recorded_but_not_authorized(self):
        out=verify_and_record(envelope(),**self.kw)
        self.assertTrue(out["verification"]["accepted"])
        self.assertFalse(out["production_authorized"])
        self.assertEqual(self.ledger.verify_chain()["event_count"],1)
    def test_simulation_rejection_is_recorded(self):
        e=envelope();e["execution"]["mode"]="simulation"
        out=verify_and_record(e,**self.kw)
        self.assertFalse(out["verification"]["accepted"])
        self.assertEqual(out["verification"]["code"],"SIMULATION_DENIED")
        self.assertEqual(self.ledger.get_by_request("req-1")[0]["event"]["decision"],"NOT_VERIFIED")
    def test_wrong_expected_revision_is_recorded(self):
        out=verify_and_record(envelope(),**(self.kw|{"expected_revision":"c"*40}))
        self.assertFalse(out["verification"]["accepted"])
        self.assertEqual(self.ledger.verify_chain()["event_count"],1)
    def test_ledger_failure_does_not_claim_persistence(self):
        bad=self.kw|{"event_id":""}
        with self.assertRaises(Exception):verify_and_record(envelope(),**bad)

if __name__=="__main__":unittest.main()
