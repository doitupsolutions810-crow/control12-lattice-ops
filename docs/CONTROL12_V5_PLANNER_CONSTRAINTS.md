# CONTROL12 v5 planner constraint contract

## Scope

`build_execution_plan` compiles a promotion intent into a deterministic execution DAG. It validates the request and binds each supported constraint to the stage that must enforce it. It is a planner, not a deployment executor: it does not itself collect live telemetry, verify an artifact signature, attest provenance, deploy a canary, or authorize production.

## Required intent

- `schema` must be `control12.intent/v5`.
- `intent` must be `deployment.promote`.
- `target.environment` must be `development`, `staging`, or `production`.
- `target.region` and `target.version` must be non-empty strings.
- `constraints` must contain exactly the supported keys below; missing and unknown keys are rejected.

| Constraint | Validation | Bound stage |
|---|---|---|
| `max_error_rate` | finite number in [0, 1) | `observe` |
| `max_p95_latency_ms` | positive finite number | `observe` |
| `canary_percent` | integer from 1 to 100 | `deploy-canary` |
| `require_signed_artifact` | must be boolean `true` | `policy-admission` |
| `require_attestation` | must be boolean `true` | `policy-admission` |

The generated plan includes `constraint_bindings` so a downstream executor cannot accidentally lose the thresholds while passing only the DAG. The `observe` binding specifies `on_violation: block-promotion`.

## Execution requirements

The executor must fail closed if a required stage, result, or evidence receipt is absent, malformed, stale, or failed. In particular:

1. Signature, SBOM, and provenance checks must pass before policy admission.
2. The canary must complete before telemetry evaluation.
3. Both observed error rate and p95 latency must meet the bound thresholds before promotion.
4. Promotion must not run if a prerequisite or observation gate fails.
5. Attestation and ledger append occur only after promotion has been independently authorized.

The planner does not prove that a downstream executor implements these rules. The executor adapter needs its own integration tests and evidence receipts before this plan can be considered end-to-end enforced. A generated plan is not production authorization.
