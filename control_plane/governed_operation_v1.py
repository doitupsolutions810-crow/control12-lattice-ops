"""Composition layer: run evidence gate, then persist its decision.

This is a library entry point, not an HTTP service. Trusted deployment code must
supply the expected subject/policy and production-grade verifier/replay adapters.
"""
from __future__ import annotations
from typing import Any, Mapping
from .evidence_gate_v1 import evaluate_evidence
from .operation_ledger_v1 import OperationLedger

def verify_and_record(
    envelope: Mapping[str, Any], *, event_id: str, expected_repository: str,
    expected_revision: str, expected_artifact_sha256: str, expected_policy_id: str,
    expected_policy_version: str, now, max_age_seconds: int, signature_verifier,
    replay_guard, ledger: OperationLedger, allow_local_evidence: bool = False,
) -> dict[str, Any]:
    """Evaluate evidence against trusted expectations and record ACCEPTED/NOT_VERIFIED.

    Expected values are supplied by trusted caller configuration. Evidence rejection
    is itself auditable. Ledger failures raise rather than reporting a recorded result.
    """
    result = evaluate_evidence(
        envelope, expected_repository=expected_repository, expected_revision=expected_revision,
        expected_artifact_sha256=expected_artifact_sha256, expected_policy_id=expected_policy_id,
        expected_policy_version=expected_policy_version, now=now, max_age_seconds=max_age_seconds,
        signature_verifier=signature_verifier, replay_guard=replay_guard,
        allow_local_evidence=allow_local_evidence,
    )
    request_id = envelope.get("request_id") if isinstance(envelope, Mapping) else None
    evidence_id = envelope.get("evidence_id") if isinstance(envelope, Mapping) else None
    request_id = request_id if isinstance(request_id, str) and request_id.strip() else "missing-request:" + event_id
    evidence_id = evidence_id if isinstance(evidence_id, str) and evidence_id.strip() else "missing-evidence:" + event_id
    event = {
        "event_id": event_id, "request_id": request_id, "evidence_id": evidence_id,
        "decision": "ACCEPTED" if result.accepted else "NOT_VERIFIED",
        "repository": expected_repository, "revision": expected_revision,
        "artifact_sha256": expected_artifact_sha256, "policy_id": expected_policy_id,
        "policy_version": expected_policy_version, "verifier_code": result.code,
    }
    receipt = ledger.append_decision(event, created_at=now)
    return {"verification": result.as_dict(), "ledger_receipt": receipt.as_dict(),
            "production_authorized": False}
