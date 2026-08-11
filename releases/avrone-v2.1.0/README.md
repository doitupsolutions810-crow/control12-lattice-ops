# Avrone Sovereign Fabric v2.1.0 — Persistent Operational Institution

This review package records the v2.1.0 evolution from a governed mission demonstration into a persistent operational institution.

## Operational capabilities

- selectable SQLite development state and PostgreSQL production state
- separate lease-based worker process with heartbeat, ownership checks, recovery and idempotent jobs
- durable connector outbox with retry, dead-letter and receipts
- scheduled institutional reviews that can produce lessons and unapproved improvement proposals
- allowlisted HTTP/HTTPS deployment monitoring with status and latency SLO observations
- two independent constitutional approval votes plus a distinct activator
- atomic constitutional activation with persisted activator identity and canonical receipt
- GitHub improvement-PR delivery only for admitted candidates
- Supabase/PostgreSQL runtime schema with service-owned deny-client RLS policies

## Validation

- Python compilation: PASS
- Test suite: 41 passed, 0 failed
- Live API + separate worker loop: PASS
- Scheduled review execution: PASS
- Deployment monitor probe: PASS
- Constitutional self-approval denial: PASS
- Activation-before-quorum denial: PASS
- Voter-as-activator denial: PASS
- Independent third-authority activation: PASS
- Repeated activation denial: PASS
- Activator identity and activation receipt persistence: PASS
- Supabase migrations: APPLIED
- Supabase runtime tables: 37
- Supabase deny-client RLS policies: 37
- Supabase activation-evidence columns: 3
- Supabase security advisor: zero current lints
- deterministic double-build equality: PASS
- ZIP CRC and path traversal validation: PASS
- embedded credential scan: PASS

## Canonical archive

`avrone-sovereign-fabric-v2.1.0.zip`

SHA-256: `bfbdccfdcead72227929803906fc3990a538e15508bb79200cb5b314c995ab29`

The archive contains 104 files: one authoritative `RELEASE_MANIFEST.json` plus 103 manifest-tracked source files. Its checksum is distributed externally as `avrone-sovereign-fabric-v2.1.0.zip.sha256`; it is intentionally not embedded in the ZIP, avoiding a circular self-hash.

## Safety boundary

The following remain disabled by default:

- agent execution
- training execution
- rollout application
- external connector delivery
- cleanroom command execution
- improvement candidate building

OpenAI and Wolfram integrations fail closed until operator-managed replacement credentials are installed through a secret store. No API keys, service-role keys, database passwords, signing keys or `.env` files are committed.

This branch remains a draft admission proposal. Merging into `main`, enabling connectors, and deploying to external infrastructure remain separate human decisions.
