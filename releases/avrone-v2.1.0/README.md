# Avrone Sovereign Fabric v2.1.0 — Persistent Operational Institution

This review package records the v2.1.0 evolution from a governed mission demonstration into a persistent operational institution.

## Operational capabilities

- selectable SQLite development state and PostgreSQL production state
- separate lease-based worker process with heartbeat, ownership checks, recovery and idempotent jobs
- durable connector outbox with retry, dead-letter and receipts
- scheduled institutional reviews that can produce lessons and unapproved improvement proposals
- allowlisted HTTP/HTTPS deployment monitoring with status and latency SLO observations
- two independent constitutional approval votes plus a distinct activator
- GitHub improvement-PR delivery only for admitted candidates
- Supabase/PostgreSQL runtime schema with service-owned deny-client RLS policies

## Validation

- Python compilation: PASS
- Test suite: 41 passed, 0 failed
- Standalone governed mission demonstration: PASS
- Live API + separate worker loop: PASS
- Scheduled review execution: PASS
- Deployment monitor probe: PASS
- Constitutional two-vote board and independent activation: PASS
- Supabase migration: APPLIED
- Supabase runtime tables: 37
- Supabase deny-client RLS policies: 37
- Supabase security advisor: zero current lints
- ZIP CRC and path traversal validation: PASS
- Embedded credential scan: PASS

## Canonical archive

`avrone-sovereign-fabric-v2.1.0.zip`

SHA-256: `119382f6b72da8c355c1660df5da8b465781b31b9cd95d096416bc32293ddcc5`

The binary archive is distributed separately. Accept it only when the SHA-256 above matches and the included offline release verifier passes.

## Safety boundary

The following remain disabled by default:

- agent execution
- training execution
- rollout application
- external connector delivery
- cleanroom command execution
- improvement candidate building

OpenAI and Wolfram integrations fail closed until operator-managed replacement credentials are installed through a secret store. No API keys, service-role keys, database passwords, signing keys or `.env` files are committed.

This branch is intentionally proposed through a draft pull request. Merging into `main`, enabling connectors, and deploying to external infrastructure remain separate human admission decisions.
