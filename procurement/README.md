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

At the recorded observation time, G0 and provider telemetry were healthy, but both evidence-console API routes returned HTTP 404. The present procurement decision is therefore `HOLD_EVIDENCE_CONTROL`, with one immediate action: restore the v5.3.1 evidence-console contract.

## Run the live evaluator

```bash
node procurement/evaluate.mjs
```

The evaluator never converts missing evidence into approval. It reports procurement and production decisions separately.
