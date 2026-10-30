# Meta-Observer Wire

## What changed
- CONTROL12's OBSERVE step now emits a heartbeat residual: S = fraction of
  attested actions with no OBSERVE entry. Latency breaches are a separate axis.
- Unmeasured state (no actions yet) = HOLD_UNMEASURED.

## Why
OBSERVE was a leaf with no parent. The Gödel seam: nothing attested the
attestation. This wire doesn't close the seam — it measures the shadow the
seam casts (unobserved actions, late observations). That's the only move
available from inside a system: you can't watch the watcher, but you can
count what the watcher missed.

## Success criteria
1. Every action interval produces an obs_residual. [wire]
2. S == 0 and zero breaches = READY_CONE. [wire]
3. Latency breaches flag without raising S. [wire]
4. HOLD_UNMEASURED on zero actions. [wire]
