from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys


def load_planner():
    path = Path(__file__).resolve().parents[1] / "control-plane" / "planner.py"
    spec = spec_from_file_location("control12_v5_planner", path)
    module = module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def make_intent(environment="production", residual=None):
    intent = {
        "schema": "control12.intent/v5",
        "intent": "deployment.promote",
        "target": {"environment": environment, "region": "eu-central", "version": "v5.0.0"},
        "constraints": {
            "max_error_rate": 0.01,
            "max_p95_latency_ms": 250,
            "canary_percent": 5,
            "require_signed_artifact": True,
            "require_attestation": True
        }
    }
    if residual is not None:
        intent["residual"] = residual
    return intent


def test_build_execution_plan_orders_governed_release_flow_and_carries_residual():
    planner = load_planner()
    residual = {"S": 0.12, "psi": "PENDING", "orientation": "measured"}
    plan = planner.build_execution_plan(make_intent(residual=residual))
    ids = [step["id"] for step in plan["steps"]]
    assert plan["schema"] == "control12.execution-plan/v5"
    assert ids[0] == "resolve-release"
    assert "policy-admission" in ids
    assert ids[-2:] == ["attest", "ledger"]
    assert plan["residual"] == residual
    for step in plan["steps"]:
        if step["id"] in {"policy-admission", "deploy-canary", "observe", "promote", "attest", "ledger"}:
            assert step["residual"] == residual


def test_production_rejects_missing_residual():
    planner = load_planner()
    try:
        planner.build_execution_plan(make_intent())
    except ValueError as exc:
        assert "requires measured residual" in str(exc)
    else:
        raise AssertionError("production intent without residual must be held")


def test_rejects_non_finite_or_out_of_range_residual():
    planner = load_planner()
    for value in (float("nan"), float("inf"), -0.01, 1.01, True):
        try:
            planner.build_execution_plan(make_intent(residual={"S": value, "psi": "PENDING"}))
        except ValueError as exc:
            assert "residual.S" in str(exc)
        else:
            raise AssertionError(f"invalid residual accepted: {value}")


def test_rejects_missing_psi():
    planner = load_planner()
    try:
        planner.build_execution_plan(make_intent(residual={"S": 0.2}))
    except ValueError as exc:
        assert "residual.psi" in str(exc)
    else:
        raise AssertionError("missing residual.psi must be held")


def test_development_can_plan_without_residual():
    planner = load_planner()
    plan = planner.build_execution_plan(make_intent(environment="development"))
    assert plan["residual"] is None


def test_rejects_unknown_schema():
    planner = load_planner()
    try:
        planner.build_execution_plan({"schema": "unknown"})
    except ValueError as exc:
        assert "unsupported intent schema" in str(exc)
    else:
        raise AssertionError("unknown schema must be rejected")
