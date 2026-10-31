from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Any, Dict, List


@dataclass(frozen=True)
class ExecutionStep:
    id: str
    action: str
    requires: tuple[str, ...] = ()
    residual: Dict[str, Any] | None = None


def _validated_residual(intent: Dict[str, Any], environment: str) -> Dict[str, Any] | None:
    residual = intent.get("residual")
    if environment != "production" and residual is None:
        return None
    if not isinstance(residual, dict):
        raise ValueError("production intent requires measured residual evidence")
    value = residual.get("S")
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
        raise ValueError("residual.S must be finite and within [0,1]")
    psi = residual.get("psi")
    if not isinstance(psi, str) or not psi.strip():
        raise ValueError("residual.psi must be a non-empty string")
    return dict(residual)


def build_execution_plan(intent: Dict[str, Any]) -> Dict[str, Any]:
    """Compile a validated CONTROL12 intent into a deterministic execution DAG."""
    if intent.get("schema") != "control12.intent/v5":
        raise ValueError("unsupported intent schema")

    target = intent.get("target") or {}
    constraints = intent.get("constraints") or {}
    environment = target.get("environment")
    if environment not in {"development", "staging", "production"}:
        raise ValueError("invalid target environment")

    residual = _validated_residual(intent, environment)
    steps: List[ExecutionStep] = [
        ExecutionStep("resolve-release", "release.resolve"),
        ExecutionStep("verify-source", "source.verify", ("resolve-release",)),
        ExecutionStep("verify-sbom", "sbom.verify", ("verify-source",)),
        ExecutionStep("verify-signature", "signature.verify", ("verify-source",)),
        ExecutionStep("verify-provenance", "provenance.verify", ("verify-source",)),
        ExecutionStep("policy-admission", "policy.evaluate", (
            "verify-sbom", "verify-signature", "verify-provenance"
        ), residual),
        ExecutionStep("deploy-canary", "deployment.canary", ("policy-admission",), residual),
        ExecutionStep("observe", "telemetry.evaluate", ("deploy-canary",), residual),
        ExecutionStep("promote", "deployment.promote", ("observe",), residual),
        ExecutionStep("attest", "attestation.issue", ("promote",), residual),
        ExecutionStep("ledger", "ledger.append", ("attest",), residual),
    ]

    return {
        "schema": "control12.execution-plan/v5",
        "intent": intent["intent"],
        "target": target,
        "constraints": constraints,
        "residual": residual,
        "steps": [asdict(step) for step in steps],
    }
