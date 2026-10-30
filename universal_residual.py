# UNIVERSAL RESIDUAL — one schema for every layer of the cut
# action | observation | heartbeat | evolve-attempt all emit the same object.
# Success criterion: any subsystem can be attested by reading only this schema.

phi = (5 ** 0.5 - 1) / 2
cone = phi ** -2


def universal_residual(kind, failures, runs, extra=None):
    """kind: action|observe|heartbeat|evolve. One math, every depth."""
    if runs is None or runs <= 0:
        base = {"kind": kind, "S": None, "orientation": "unmeasured", "status": "HOLD_UNMEASURED", "ts": None}
    else:
        S = failures / runs
        orient = "pass" if failures == 0 else ("fail" if failures == runs else "mixed")
        base = {"kind": kind, "S": S, "orientation": orient,
                "status": "READY_CONE" if (S <= cone and orient == "pass") else "READY",
                "cone_floor": cone}
    if extra:
        base.update(extra)
    return base


# invariant: no READY without orientation != "unmeasured"; no READY_CONE without S <= cone
