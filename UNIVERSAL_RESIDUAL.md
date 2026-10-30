# Universal Residual

## What changed
- One residual schema (kind, S, orientation, status, cone_floor, ts) emitted by
  actions, OBSERVE heartbeats, meta-heartbeats, and evolve attempts alike.
- The cut replicates at every depth; the wire replicates with it.

## Why
Each layer invented its own measurement (attempt rows, obs_residual, evidence snapshots).
The profound finding: the recursion x=1+1/x that produced phi is the same
contraction that compounds meta-observer coverage. One equation, every depth.
Unifying the schema makes that visible and makes cross-layer attestation possible:
you can now ask "is the observer observed?" by reading the same object.

## Success criteria
1. Single schema accepted by all four layer types. [wire]
2. HOLD_UNMEASURED on zero runs at every kind. [wire]
3. READY_CONE only when S on cone and orientation pass. [wire]
4. Cross-layer query: filter by kind, compare S. [wire]
