import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def load_planner():
    path = Path(__file__).resolve().parents[1] / "control-plane" / "planner.py"
    spec = spec_from_file_location("control12_v5_planner", path)
    module = module_from_spec(spec)
    assert spec and spec.loader
    # dataclasses resolves string annotations via sys.modules[cls.__module__]; an
    # unregistered module raised AttributeError: 'NoneType' object has no attribute '__dict__'.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_build_execution_plan_orders_governed_release_flow():
    planner = load_planner()
    intent = {
        "schema": "control12.intent/v5",
        "intent": "deployment.promote",
        "target": {
            "environment": "production",
            "region": "eu-central",
            "version": "v5.0.0"
        },
        "constraints": {
            "max_error_rate": 0.01,
            "max_p95_latency_ms": 250,
            "canary_percent": 5,
            "require_signed_artifact": True,
            "require_attestation": True
        }
    }

    plan = planner.build_execution_plan(intent)
    ids = [step["id"] for step in plan["steps"]]

    assert plan["schema"] == "control12.execution-plan/v5"
    assert ids[0] == "resolve-release"
    assert "policy-admission" in ids
    assert ids[-2:] == ["attest", "ledger"]


def test_rejects_unknown_schema():
    planner = load_planner()
    try:
        planner.build_execution_plan({"schema": "unknown"})
    except ValueError as exc:
        assert "unsupported intent schema" in str(exc)
    else:
        raise AssertionError("unknown schema must be rejected")
