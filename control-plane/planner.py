from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Any, Dict, List


@dataclass(frozen=True)
class ExecutionStep:
    id: str
    action: str
    requires: tuple[str, ...] = ()


_REQUIRED_CONSTRAINTS = {
    "max_error_rate",
    "max_p95_latency_ms",
    "canary_percent",
    "require_signed_artifact",
    "require_attestation",
}


def _validate_intent(intent: Any) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if not isinstance(intent, dict):
        raise ValueError("intent must be an object")
    if intent.get("schema") != "control12.intent/v5":
        raise ValueError("unsupported intent schema")
    if intent.get("intent") != "deployment.promote":
        raise ValueError("unsupported intent action; expected deployment.promote")

    target = intent.get("target")
    constraints = intent.get("constraints")
    if not isinstance(target, dict):
        raise ValueError("target must be an object")
    if not isinstance(constraints, dict):
        raise ValueError("constraints must be an object")

    environment = target.get("environment")
    if environment not in {"development", "staging", "production"}:
        raise ValueError("invalid target environment")
    for field in ("region", "version"):
        value = target.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"target.{field} must be a non-empty string")

    missing = _REQUIRED_CONSTRAINTS - constraints.keys()
    unknown = constraints.keys() - _REQUIRED_CONSTRAINTS
    if missing:
        raise ValueError("missing required constraints: " + ", ".join(sorted(missing)))
    if unknown:
        raise ValueError("unsupported constraints: " + ", ".join(sorted(unknown)))

    error_rate = constraints["max_error_rate"]
    if (
        isinstance(error_rate, bool)
        or not isinstance(error_rate, (int, float))
        or not math.isfinite(float(error_rate))
        or not 0 <= float(error_rate) < 1
    ):
        raise ValueError("max_error_rate must be finite and in [0, 1)")

    latency = constraints["max_p95_latency_ms"]
    if (
        isinstance(latency, bool)
        or not isinstance(latency, (int, float))
        or not math.isfinite(float(latency))
        or float(latency) <= 0
    ):
        raise ValueError("max_p95_latency_ms must be a positive finite number")

    canary = constraints["canary_percent"]
    if isinstance(canary, bool) or not isinstance(canary, int) or not 1 <= canary <= 100:
        raise ValueError("canary_percent must be an integer in [1, 100]")

    for flag in ("require_signed_artifact", "require_attestation"):
        if constraints[flag] is not True:
            raise ValueError(f"{flag} must be true for a governed promotion")

    normalized_constraints = {
        "max_error_rate": float(error_rate),
        "max_p95_latency_ms": float(latency),
        "canary_percent": canary,
        "require_signed_artifact": True,
        "require_attestation": True,
    }
    return target, normalized_constraints, intent


def build_execution_plan(intent: Dict[str, Any]) -> Dict[str, Any]:
    """Compile a validated promotion intent into a deterministic, constraint-bound DAG.

    This compiles policy requirements; it does not itself perform runtime metric
    evaluation, authorize production, deploy a workload, or issue an attestation.
    The executor must enforce each binding and provide evidence before a downstream
    step is eligible to run.
    """
    target, constraints, validated_intent = _validate_intent(intent)

    steps: List[ExecutionStep] = [
        ExecutionStep("resolve-release", "release.resolve"),
        ExecutionStep("verify-source", "source.verify", ("resolve-release",)),
        ExecutionStep("verify-sbom", "sbom.verify", ("verify-source",)),
        ExecutionStep("verify-signature", "signature.verify", ("verify-source",)),
        ExecutionStep("verify-provenance", "provenance.verify", ("verify-source",)),
        ExecutionStep(
            "policy-admission",
            "policy.evaluate",
            ("verify-sbom", "verify-signature", "verify-provenance"),
        ),
        ExecutionStep("deploy-canary", "deployment.canary", ("policy-admission",)),
        ExecutionStep("observe", "telemetry.evaluate", ("deploy-canary",)),
        ExecutionStep("promote", "deployment.promote", ("observe",)),
        ExecutionStep("attest", "attestation.issue", ("promote",)),
        ExecutionStep("ledger", "ledger.append", ("attest",)),
    ]

    return {
        "schema": "control12.execution-plan/v5",
        "intent": validated_intent["intent"],
        "target": target,
        "constraints": constraints,
        "constraint_bindings": {
            "policy-admission": {
                "require_signed_artifact": constraints["require_signed_artifact"],
                "require_attestation": constraints["require_attestation"],
            },
            "deploy-canary": {
                "canary_percent": constraints["canary_percent"],
            },
            "observe": {
                "max_error_rate": constraints["max_error_rate"],
                "max_p95_latency_ms": constraints["max_p95_latency_ms"],
                "on_violation": "block-promotion",
            },
        },
        "promotion_invariants": [
            "signature verification must pass before policy admission",
            "provenance and SBOM verification must pass before policy admission",
            "canary must complete before telemetry evaluation",
            "error-rate and p95-latency thresholds must pass before promotion",
            "promotion must not execute when any prerequisite is missing or failed",
            "attestation and ledger append occur only after promotion is authorized",
        ],
        "steps": [asdict(step) for step in steps],
    }
