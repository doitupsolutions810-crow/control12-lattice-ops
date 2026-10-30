# CONTROL12 Planner v5 — Residual-Aware

## What changed

`planner.py` now threads a **residual coordinate** through every DAG step.
Every intent carries `residual: {S, orientation, psi, cone_status, p, runs, failures}`.

## The hard gate

Production intents require:
- `residual.S == 0.0` (cone floor)
- `residual.orientation in {pass, fail}` (deterministic)

Unmeasured or mixed residuals are rejected before PLAN. This is invariant
`production_intent_requires_measured_residual` from agent-capabilities v5.

## Why

Previously lattice-ops main emitted zero-residual intents. Deployed directly,
they bypassed Avrone's adapter gate silently. Now the planner itself enforces
the measurement requirement — defense in depth, not a single chokepoint.

## Lineage

Sourced from `avrone/control12_adapter.py` on branch `emergent-compile`.
The adapter and planner now agree on the residual schema.
