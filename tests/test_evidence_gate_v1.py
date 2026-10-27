from datetime import datetime, timezone
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location
import sys
import unittest

PATH = Path(__file__).resolve().parents[1] / "control_plane" / "evidence_gate_v1.py"
SPEC = spec_from_file_location("evidence_gate_v1", PATH)
GATE = module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = GATE
SPEC.loader.exec_module(GATE)


class MemoryReplayGuard:
    """Test-only guard. Production must use durable atomic shared storage."""
    def __init__(self):
        self.seen = set()
    def consume_once(self, request_id, evidence_id):
        pair = (request_id, evidence_id)
        if pair in self.seen:
            return False
        self.seen.add(pair)
        return True


def envelope():
    return {
        "schema": "control12.evidence-envelope/v1", "evidence_id": "evidence-001",
        "claim": {"status": "PASS", "summary": "tests passed"},
        "subject": {"repository": "org/service", "revision": "a" * 40, "artifact_sha256": "b" * 64},
        "execution": {"mode": "real", "worker_receipt_id": "receipt-001", "local": False},
        "authority": {"issuer": "ci-attestor", "key_id": "release-key-1"},
        "policy": {"id": "production-release", "version": "1.0.0"},
        "issued_at": "2026-10-27T12:00:00Z", "expires_at": "2026-10-27T13:00:00Z",
        "request_id": "request-001", "signature": {"algorithm": "Ed25519", "value": "test-signature"},
    }


class EvidenceGateTests(unittest.TestCase):
    def setUp(self):
        self.env = envelope()
        self.guard = MemoryReplayGuard()
        self.kwargs = dict(
            expected_repository="org/service", expected_revision="a" * 40,
            expected_artifact_sha256="b" * 64, expected_policy_id="production-release",
            expected_policy_version="1.0.0", now=datetime(2026, 10, 27, 12, 30, tzinfo=timezone.utc),
            max_age_seconds=3600, signature_verifier=lambda _e: True, replay_guard=self.guard,
        )

    def evaluate(self, **overrides):
        kwargs = dict(self.kwargs); kwargs.update(overrides)
        return GATE.evaluate_evidence(self.env, **kwargs)

    def test_accepts_bound_fresh_real_evidence_but_does_not_authorize_production(self):
        result = self.evaluate()
        self.assertTrue(result.accepted)
        self.assertFalse(result.production_authorized)

    def test_rejects_simulation(self):
        self.env["execution"]["mode"] = "simulation"
        self.assertEqual(self.evaluate().code, "SIMULATION_DENIED")

    def test_rejects_missing_receipt(self):
        self.env["execution"]["worker_receipt_id"] = ""
        self.assertEqual(self.evaluate().code, "MISSING_WORKER_RECEIPT")

    def test_rejects_wrong_revision(self):
        self.env["subject"]["revision"] = "c" * 40
        self.assertEqual(self.evaluate().code, "REVISION_MISMATCH")

    def test_rejects_wrong_artifact(self):
        self.env["subject"]["artifact_sha256"] = "c" * 64
        self.assertEqual(self.evaluate().code, "ARTIFACT_MISMATCH")

    def test_rejects_wrong_policy(self):
        self.env["policy"]["version"] = "9.9.9"
        self.assertEqual(self.evaluate().code, "POLICY_MISMATCH")

    def test_rejects_bad_signature(self):
        self.assertEqual(self.evaluate(signature_verifier=lambda _e: False).code, "SIGNATURE_UNVERIFIED")

    def test_rejects_expired_evidence(self):
        self.kwargs["now"] = datetime(2026, 10, 27, 14, 0, tzinfo=timezone.utc)
        self.assertEqual(self.evaluate().code, "EXPIRED_EVIDENCE")

    def test_rejects_future_evidence(self):
        self.env["issued_at"] = "2026-10-27T12:45:00Z"
        self.env["expires_at"] = "2026-10-27T14:00:00Z"
        self.assertEqual(self.evaluate().code, "FUTURE_EVIDENCE")

    def test_rejects_stale_evidence(self):
        self.kwargs["max_age_seconds"] = 60
        self.assertEqual(self.evaluate().code, "STALE_EVIDENCE")

    def test_rejects_local_evidence_by_default(self):
        self.env["execution"]["local"] = True
        self.assertEqual(self.evaluate().code, "LOCAL_EVIDENCE_DENIED")

    def test_rejects_replay(self):
        self.assertTrue(self.evaluate().accepted)
        self.assertEqual(self.evaluate().code, "REPLAY_OR_REPLAY_STORE_FAILURE")

    def test_replay_guard_exception_fails_closed(self):
        class Broken:
            def consume_once(self, *_): raise RuntimeError("storage unavailable")
        self.assertEqual(self.evaluate(replay_guard=Broken()).code, "REPLAY_OR_REPLAY_STORE_FAILURE")

    def test_verifier_exception_fails_closed(self):
        self.assertEqual(self.evaluate(signature_verifier=lambda _e: 1 / 0).code, "SIGNATURE_UNVERIFIED")

    def test_rejects_non_utc_timestamp(self):
        self.env["issued_at"] = "2026-10-27T12:00:00+00:00"
        self.assertEqual(self.evaluate().code, "INVALID_TIMESTAMPS")

    def test_rejects_invalid_max_age(self):
        self.assertEqual(self.evaluate(max_age_seconds=0).code, "INVALID_FRESHNESS_POLICY")


if __name__ == "__main__":
    unittest.main()
