# CONTROL12 procurement success path

This package separates two decisions that were previously mixed together:

1. **May the organization procure the solution?**
2. **May the solution be activated in production?**

Procurement may proceed before production activation, but evidence and security rules cannot be weakened.

## One procurement decision, three purchase bundles

| Bundle | Plain-language purchase | Gates covered |
|---|---|---|
| Managed foundation | Shared state, secure secrets, signed image registry | G1, G2, G4 |
| Worker capacity | One acceptance worker now; a second before availability is claimed | G3 |
| Acceptance and operations | Canary, receipt, monitoring, rollback, recovery, named owners | G5, G6 |

The existing control plane gate G0 must already pass. The evidence console must also prove the unchanged trust contract before purchase approval.

## Decision meanings

- `HOLD_EVIDENCE_CONTROL`: do not approve purchase because evidence policy cannot be verified or has weakened.
- `HOLD_BASELINE_CONTROL`: do not approve purchase because the existing control plane or providers are unavailable.
- `READY_FOR_PROCUREMENT`: approve the controlled purchase plan; production remains disabled.
- `NO_GO`: production activation remains prohibited.
- `GO`: all production gates and live operations checks have passed.

## Current state

At the recorded observation time, G0 and provider telemetry were healthy, but both evidence-console API routes returned HTTP 404. The present procurement decision is therefore `HOLD_EVIDENCE_CONTROL`, with one immediate action: restore the v5.4.0 evidence-console contract.

## Run the live evaluator

```bash
node procurement/evaluate.mjs
```

The evaluator never converts missing evidence into approval. It reports procurement and production decisions separately.


## Follow-up — v5.4.0 signed evidence source scaffold (not deployed)

PR #31 now includes a candidate evidence-console application under evidence-console/ with read-only GET endpoints at /api/status and /api/v1/evidence/schema. The status payload is generated per request, expires after 60 seconds, contains a canonical SHA-256 digest, and is signed with Ed25519. The consumer independently pins the source key ID and public key. Missing or mismatched signing material yields HTTP 503 and leaves procurement on HOLD_EVIDENCE_CONTROL.

The evidence-console uses contract-check IDs E0–E6; these do not represent the production readiness gates G0–G6. Production remains NO_GO until the separate production evaluator's evidence is complete. The existing Vercel project needs Root Directory set to evidence-console and owner-approved runtime key configuration before deployment. No production key was generated, no Vercel setting was changed, and no deployment was performed in this work.

Local isolated producer regression harness: 8/8 tests passed using an ephemeral in-memory Ed25519 keypair. This is not yet the full repository suite or live hosted endpoint evidence. CI runs still need actual executed step records.
