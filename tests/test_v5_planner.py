from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest


def load_planner():
    path = Path(__file__).resolve().parents[1] / "control-plane" / "planner.py"
    spec = spec_from_file_location("control12_v5_planner", path)
    module = module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def valid_intent():
    return {
        "schema": "control12.intent/v5",
        "intent": "deployment.promote",
        "target": {
            "environment": "production",
            "region": "eu-central",
            "version": "v5.0.0",
        },
        "constraints": {
            "max_error_rate": 0.01,
            "max_p95_latency_ms": 250,
            "canary_percent": 5,
            "require_signed_artifact": True,
            "require_attestation": True,
        },
    }


def test_build_execution_plan_orders_governed_release_flow():
    planner = load_planner()
    plan = planner.build_execution_plan(valid_intent())
    ids = [step["id"] for step in plan["steps"]]

    assert plan["schema"] == "control12.execution-plan/v5"
    assert ids[0] == "resolve-release"
    assert "policy-admission" in ids
    assert ids[-2:] == ["attest", "ledger"]
    assert plan["promotion_invariants"]
    assert plan["constraint_bindings"]["deploy-canary"]["canary_percent"] == 5
    assert plan["constraint_bindings"]["observe"] == {
        "max_error_rate": 0.01,
        "max_p95_latency_ms": 250.0,
        "on_violation": "block-promotion",
    }


def test_constraints_are_bound_to_the_steps_that_must_enforce_them():
    planner = load_planner()
    intent = valid_intent()
    intent["constraints"].update(
        max_error_rate=0.025,
        max_p95_latency_ms=180,
        canary_percent=12,
    )
    plan = planner.build_execution_plan(intent)

    assert plan["constraint_bindings"]["observe"]["max_error_rate"] == 0.025
    assert plan["constraint_bindings"]["observe"]["max_p95_latency_ms"] == 180.0
    assert plan["constraint_bindings"]["deploy-canary"]["canary_percent"] == 12


def test_plan_is_deterministic_for_the_same_intent():
    planner = load_planner()
    intent = valid_intent()
    assert planner.build_execution_plan(intent) == planner.build_execution_plan(intent)


@pytest.mark.parametrize("intent", [None, [], "bad", 1])
def test_rejects_non_object_intent(intent):
    with pytest.raises(ValueError, match="intent must be an object"):
        load_planner().build_execution_plan(intent)


def test_rejects_unknown_schema_and_non_promotion_action():
    planner = load_planner()
    intent = valid_intent()
    intent["schema"] = "unknown"
    with pytest.raises(ValueError, match="unsupported intent schema"):
        planner.build_execution_plan(intent)

    intent = valid_intent()
    intent["intent"] = "shell.execute"
    with pytest.raises(ValueError, match="unsupported intent action"):
        planner.build_execution_plan(intent)


@pytest.mark.parametrize("target", [None, [], "production"])
def test_rejects_malformed_target(target):
    intent = valid_intent()
    intent["target"] = target
    with pytest.raises(ValueError, match="target must be an object"):
        load_planner().build_execution_plan(intent)


@pytest.mark.parametrize("field,value", [
    ("region", ""),
    ("region", None),
    ("version", " "),
    ("version", None),
    ("environment", "unknown"),
])
def test_rejects_malformed_target_fields(field, value):
    intent = valid_intent()
    intent["target"][field] = value
    with pytest.raises(ValueError):
        load_planner().build_execution_plan(intent)


def test_requires_all_constraints_and_rejects_unknown_constraints():
    planner = load_planner()
    intent = valid_intent()
    del intent["constraints"]["canary_percent"]
    with pytest.raises(ValueError, match="missing required constraints"):
        planner.build_execution_plan(intent)

    intent = valid_intent()
    intent["constraints"]["skip_signature_check"] = True
    with pytest.raises(ValueError, match="unsupported constraints"):
        planner.build_execution_plan(intent)


@pytest.mark.parametrize("value", [-0.1, 1, float("nan"), float("inf"), True, "0.1"])
def test_rejects_invalid_error_rate(value):
    intent = valid_intent()
    intent["constraints"]["max_error_rate"] = value
    with pytest.raises(ValueError, match="max_error_rate"):
        load_planner().build_execution_plan(intent)


@pytest.mark.parametrize("value", [0, -1, float("nan"), float("inf"), True, "250"])
def test_rejects_invalid_latency(value):
    intent = valid_intent()
    intent["constraints"]["max_p95_latency_ms"] = value
    with pytest.raises(ValueError, match="max_p95_latency_ms"):
        load_planner().build_execution_plan(intent)


@pytest.mark.parametrize("value", [0, 101, -1, 5.5, True, "5"])
def test_rejects_invalid_canary_percentage(value):
    intent = valid_intent()
    intent["constraints"]["canary_percent"] = value
    with pytest.raises(ValueError, match="canary_percent"):
        load_planner().build_execution_plan(intent)


@pytest.mark.parametrize("field", ["require_signed_artifact", "require_attestation"])
@pytest.mark.parametrize("value", [False, None, 1, "true"])
def test_required_security_controls_cannot_be_disabled_or_coerced(field, value):
    intent = valid_intent()
    intent["constraints"][field] = value
    with pytest.raises(ValueError, match=field):
        load_planner().build_execution_plan(intent)
