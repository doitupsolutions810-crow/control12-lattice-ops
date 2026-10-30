# META-OBSERVER WIRE — heartbeat residual on CONTROL12 OBSERVE
# Success criterion: no attested action may lack an OBSERVE entry;
# latency breaches surface as a flag, not buried in S.

def obs_residual(actions_total, actions_observed, latency_breaches=0):
    """Residual on the observation process itself.
    S = unobserved fraction. Orientation: pass/fail/mixed.
    Latency is a second axis — breaches don't raise heat but raise a flag.
    Unmeasured (zero actions) = HOLD_UNMEASURED, never READY."""
    if actions_total <= 0:
        return {"S": None, "orientation": "unmeasured", "status": "HOLD_UNMEASURED"}
    coverage = actions_observed / actions_total
    S = 1 - coverage
    orient = "pass" if S == 0 else ("fail" if coverage == 0 else "mixed")
    return {"S": S, "orientation": orient,
            "latency_breaches": latency_breaches,
            "status": ("READY_CONE" if S == 0 and latency_breaches == 0 else "READY"),
            "invariant": "no action valid without observation"}
