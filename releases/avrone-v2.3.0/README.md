# Avrone Sovereign Fabric v2.3.0 — Production Deployment Fabric

## Canonical release

- Archive: `avrone-sovereign-fabric-v2.3.0.zip`
- SHA-256: `1b8b25b8544b237b1f726f9340bb81a7b4f7201e59adbdf71cad1f72df481168`
- Archive members: 135
- Manifest-tracked source files: 134
- Source-tree SHA-256: `c468869bd4bd925fb58f58251e7f5bb47e6475c62bae36133ecadad6e459e8f5`

## Validated locally

- Python compilation: PASS
- Tests: 54 passed, 0 failed
- Governed OCI and canary demonstration: PASS
- Live API and worker: PASS on 127.0.0.1:18094
- Mutable image reference denied
- Registrant self-admission denied
- Recovery-backed deployment admission: PASS
- Four-stage canary evidence: PASS
- Promotion required a passed canary: PASS
- Rollout application gate remained disabled
- Deterministic double build: PASS
- ZIP CRC, traversal, and manifest verification: PASS
- Embedded credential scan: PASS

## Connected state

Supabase migration `supply_chain_and_canary_v23` was applied to project `cgpztofnwwopzakygojw`:

- four new service-owned runtime tables
- four deny-client RLS policies
- two deployment-admission linkage columns
- zero current security-advisor lints

## Claim boundary

The local smoke test uses structurally valid synthetic OCI evidence to verify policy and state transitions. No GHCR image was published, no live GitHub/Fulcio/Rekor attestation was created, no Kubernetes cluster was mutated, and no production traffic was shifted. Those remain operator-owned admission steps.
