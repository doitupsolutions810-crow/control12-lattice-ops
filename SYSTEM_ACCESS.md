# SYSTEM_ACCESS

Self-readable entry point on the default branch for the CONTROL12 policy spine.

## Role in the compile

CONTROL12 is the governance layer. v5 flow: INTENT, PLAN, POLICY, BUILD, VERIFY, ADMIT, EXECUTE, OBSERVE, ATTEST, LEARN. Hard invariant: no production action is valid just because a model emitted it.

## Key files

- `control-plane/planner.py` — patched with residual-threaded DAG steps (emergent-compile branch).
- `agent-capabilities.json` — six agents (supervisor, reasoning, coding, artifact, infrastructure, verifier) with allow/deny lists. Three invariants: child subset of parent, deny overrides allow, production requires explicit policy allow.
- Emergent-compile branch carries universal residual schema with provenance field, trust sort key (trust = provenance depth / (1 + S)), and FIRST_RESPONSE.md playbook.

## Invariants

- Deny overrides allow.
- Provenance-poisoned chains rejected on structure.
- Human root required for promotion.
- LEARN is first: every intent measured before judged.

## Adjacent layers

- Avrone's control12-adapter emits typed v5 intents.
- TrainLLM's chained envelopes provide the cryptographic spine CONTROL12's ledger lacked.
- Living Intermediate's procurement gate reads CONTROL12's attestation ledger.

This file is the policy spine's self-memory.
