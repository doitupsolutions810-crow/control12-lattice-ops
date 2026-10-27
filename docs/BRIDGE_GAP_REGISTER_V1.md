# Cross-Repository Bridge and Gap Register v1

## Purpose
This register makes the intended system graph explicit and assigns each edge a producer, consumer, trust boundary, required evidence, gap list, and executable acceptance test. It is a planning and conformance artifact, not evidence that an edge is connected.

Machine-readable source: `integration/bridge-contract-v1.json`.

## Promotion states
- `proposed`: intended interface; implementation or connection not established.
- `implemented_unverified`: code or contract exists, but end-to-end operation has not been verified.
- `verified`: allowed only after exact producer/consumer revisions, executed integration tests, correlated request IDs, artifact/receipt validation, and inspectable logs exist.

Never infer verification from repository names, documentation, endpoint reachability, a green static-analysis check, or a model-generated summary.

## Critical path
1. Authenticate and validate intent.
2. Generate a typed plan with enforceable constraints.
3. Authorize the complete action/resource/method tuple.
4. Execute in a real sandbox with authenticated worker identity.
5. Generate a signed receipt bound to exact source revision and output digest.
6. Verify evidence and freshness.
7. Record the decision idempotently in the operation ledger.
8. Apply an independent production admission decision.
9. Reconcile observed state and feed only verified outcomes into future planning.

Every step needs an explicit denial path. Missing or contradictory evidence yields NOT_VERIFIED and blocks promotion.

## Highest-priority gaps
1. **Critical — execution boundary:** CycleKernal shell execution and Swarm worker-event authenticity need remediation and adversarial tests.
2. **Critical — authority boundary:** capability method checks and cross-language canonicalization require shared conformance vectors.
3. **Critical — production promotion:** unsigned artifacts and incomplete provenance must fail closed.
4. **High — evidence durability:** deploy the trusted signature verifier, durable replay guard, shared transactional ledger, and independent ledger-head anchoring.
5. **High — planning constraints:** validate constraints and gate promotion on actual observed telemetry.
6. **High — network egress:** block private/reserved IP destinations and revalidate every redirect in enrichment fetches.
7. **High — authentication:** harden workspace and TrainLLM route-level access control before any public exposure.

## Verification procedure
For each interface, record producer SHA, consumer SHA, test run ID, request ID, artifact digest, result, logs, and reviewer. Change status to `verified` only when all required evidence is available. Otherwise leave the edge proposed or implemented-unverified.

## Scope limitation
This register covers ten high-impact interfaces found in the current source audit, not every possible dependency among all 35 repositories. The graph must expand as additional source paths and test manifests are reviewed.
