# Sovereign living intermediate — unified system (paths 1–8)

One control plane, multiple faces.

```text
                    ┌─────────────────────────┐
                    │  Cloudflare Access      │  edge identity (5)
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  cloudflared + mTLS     │  origin identity (5)
                    │  dual-CA hot reload (4) │
                    └───────────┬─────────────┘
                                │
┌──────────────┐    ┌───────────▼─────────────┐    ┌──────────────────┐
│ Avrone chat  │───▶│  CONTROL12 platform     │◀───│ security:pass CI  │
│ cockpit (2)  │    │  belief mesh (6)        │    │ anomalies (7)     │
└──────────────┘    │  quorum writes (3)      │    └──────────────────┘
                    │  access logs + status   │
                    │  prod profile (1)       │
                    └─────────────────────────┘
```

| # | Capability | Artifact |
|---|------------|----------|
| 1 | Prod trust profile | `profiles/production.env.example` |
| 2 | Avrone cockpit | `avrone-chat` + `/api/cockpit` |
| 3 | Quorum-only writes | `CONTROL12_CODE_REQUIRE_QUORUM=1` |
| 4 | Automated cutover | `scripts/mtls-cutover.sh` |
| 5 | Edge + origin identity | `docs/edge-origin-identity.md` |
| 6 | Belief mesh | boot seed + `seed-session-mesh.sh` |
| 7 | CI security gate | `.github/workflows/security-pass.yml` |
| 8 | This unified doc | living intermediate as product shape |

## Operator day-2

```bash
# prod start
set -a; source profiles/production.env; set +a
npm run mtls:verify
npm start

# tunnel (other terminal)
npm run tunnel:named

# mesh (optional re-seed)
bash scripts/seed-session-mesh.sh

# weekly
npm run security:pass
CONTROL12_SECURITY_ROTATE=1 npm run security:pass

# cert due
npm run mtls:cutover -- --force
```

The system remains unfinished by design: claims stay checkable against digests, access logs, and renew windows.
