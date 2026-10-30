from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List


@dataclass(frozen=True)
class ExecutionStep:
    id: str
    action: str
    requires: tuple[str, ...] = ()


def build_execution_plan(intent: Dict[str, Any]) -> Dict[str, Any]:
    """Compile a validated CONTROL12 intent into a deterministic execution DAG."""
    if intent.get("schema") != "control12.intent/v5":
        raise ValueError("unsupported intent schema")

    target = intent.get("target") or {}
    constraints = intent.get("constraints") or {}
    environment = target.get("environment")
    if environment not in {"development", "staging", "production"}:
        raise ValueError("invalid target environment")

    if environment == "production":
        if constraints.get("require_signed_artifact") is not True:
            raise ValueError("production requires signed artifacts")
        if constraints.get("require_attestation") is not True:
            raise ValueError("production requires attestation")

    steps: List[ExecutionStep] = [
        ExecutionStep("resolve-release", "release.resolve"),
        ExecutionStep("verify-source", "source.verify", ("resolve-release",)),
        ExecutionStep("verify-sbom", "sbom.verify", ("verify-source",)),
        ExecutionStep("verify-signature", "signature.verify", ("verify-source",)),
        ExecutionStep("verify-provenance", "provenance.verify", ("verify-source",)),
        ExecutionStep("policy-admission", "policy.evaluate", (
            "verify-sbom", "verify-signature", "verify-provenance"
        )),
        ExecutionStep("deploy-canary", "deployment.canary", ("policy-admission",)),
        ExecutionStep("observe", "telemetry.evaluate", ("deploy-canary",)),
        ExecutionStep("promote", "deployment.promote", ("observe",)),
        ExecutionStep("attest", "attestation.issue", ("promote",)),
        ExecutionStep("ledger", "ledger.append", ("attest",)),
    ]

    return {
        "schema": "control12.execution-plan/v5",
        "intent": intent["intent"],
        "target": target,
        "constraints": constraints,
        "steps": [asdict(step) for step in steps],
    }
