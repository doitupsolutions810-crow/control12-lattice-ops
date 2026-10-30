"""CONTROL12 planner v5 — residual-aware.

Emits intents with a measured residual coordinate. Production intents
require residual.S == 0.0 (cone floor) AND orientation in {pass, fail}
— never unmeasured, never mixed. The residual field threads through
every DAG step: PLAN, POLICY, BUILD, VERIFY, ADMIT, EXECUTE, OBSERVE,
ATTEST, LEARN.
"""
from __future__ import annotations

import time
from typing import Any


class ResidualUnmeasured(Exception):
    pass


class ResidualNotDeterministic(Exception):
    pass


def build_residual(evidence: dict[str, Any]) -> dict[str, Any]:
    """Compute residual from evidence. S = p(1-p) where p = failure rate."""
    runs = evidence.get("runs", 0)
    failures = evidence.get("failures", 0)
    if runs <= 0:
        return {"S": None, "orientation": "unmeasured", "psi": None, "cone_status": "unmeasured"}
    p = failures / runs
    S = p * (1 - p)
    if S == 0.0:
        orientation = "pass" if failures == 0 else "fail"
    else:
        orientation = "mixed"
    phi = (1 + 5 ** 0.5) / 2
    cone = phi ** -2
    return {
        "S": S,
        "orientation": orientation,
        "psi": cone + S,
        "cone_status": "floor" if S == 0.0 else "above",
        "p": p,
        "runs": runs,
        "failures": failures,
    }


def validate_intent(intent: dict[str, Any]) -> None:
    """Hard gate: production intents need measured, deterministic residual."""
    target_env = (intent.get("target") or {}).get("environment")
    residual = intent.get("residual")
    if target_env == "production":
        if residual is None or residual.get("S") is None:
            raise ResidualUnmeasured(
                f"production intent {intent.get('intent')} has unmeasured residual"
            )
        if residual["S"] != 0.0 or residual["orientation"] not in ("pass", "fail"):
            raise ResidualNotDeterministic(
                f"production intent {intent.get('intent')} residual not deterministic: "
                f"S={residual.get('S')}, orientation={residual.get('orientation')}"
            )


def intent_to_plan(intent: dict[str, Any]) -> dict[str, Any]:
    """Thread residual through the full v5 DAG."""
    validate_intent(intent)
    residual = intent["residual"]
    steps = ["PLAN", "POLICY", "BUILD", "VERIFY", "ADMIT", "EXECUTE", "OBSERVE", "ATTEST", "LEARN"]
    dag = []
    for step in steps:
        dag.append(
            {
                "step": step,
                "residual": residual,
                "valid": residual["S"] is not None,
            }
        )
    return {
        "schema": "control12.plan/v5",
        "intent": intent.get("intent"),
        "action": intent.get("action"),
        "target": intent.get("target"),
        "actor": intent.get("actor"),
        "residual": residual,
        "dag": dag,
        "ts": time.time(),
    }
