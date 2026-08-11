# Unified system v2 — paths 1–6

Builds on sovereign living intermediate (v1 paths 1–8).

| # | Capability | Artifact |
|---|------------|----------|
| 1 | Renew & respond loop | `scripts/renew-respond-loop.sh` · `npm run renew:loop` |
| 2 | Cockpit actions | `POST /api/v1/cockpit/action` · avrone-chat cockpit UI |
| 3 | Federated digests | `FederationHub` · `/api/v1/federation/*` |
| 4 | Policy-as-evidence | `policy/evidence.mjs` on quorum summary |
| 5 | Jacobian tune | `jacobian-tune.mjs` · outcome recording |
| 6 | Attestation seals | `attestation/seal.mjs` on rotation/quorum |

```text
renew:loop ──► cutover / anomalies
     │
cockpit actions ──► reload · mesh · quorum · federation publish
     │
federation digests ◄── peers (belief/spectrum only)
     │
quorum ──► evidence record ──► attestation seal
     │
jacobian tune ◄── accept/reject outcomes
```

## Commands

```bash
npm run renew:loop
curl -X POST -H "Authorization: Bearer $TOKEN" -d '{"action":"tls_reload"}' \
  http://127.0.0.1:4400/api/v1/cockpit/action
```
