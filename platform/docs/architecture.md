# CONTROL12 Sovereign Platform Architecture

```mermaid
flowchart LR
  UI["Dashboard and API"] --> CP["Runtime Supervisor"]
  CP --> PE["Capability Policy Engine"]
  CP --> WS["Workflow Scheduler"]
  WS --> AS["Five-Agent SDK"]
  WS --> AB["Artifact Builder"]
  WS --> DC["Deployment Coordinator"]
  CP --> CR["Component Registry"]
  CP --> KG["Knowledge Graph"]
  AS --> LA["CONTROL12 Local Agent"]
  LA --> LM["llama.cpp Model"]
  CP --> MB["Durable Message Bus"]
  MB --> AU["Audit and Event Ledger"]
```

The platform uses five immutable governance roles—planner, engineer, artifact, operations, verifier—while provider plugins remain capability manifests subject to policy, approval, audit, and provenance controls.

## Invariants

1. Production deployments require digest-pinned images.
2. High-risk actions require explicit approval according to environment policy.
3. Every event and component has a SHA-256 digest.
4. Artifact payloads and manifests are written separately and hashed.
5. Agent execution uses the evidence-grounded local-agent API.
6. Mutating APIs can require a bearer token.
7. Containers run non-root with dropped capabilities and read-only filesystems.
