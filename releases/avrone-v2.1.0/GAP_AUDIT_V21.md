# Gap audit — v2.1.0

## Closed

- single-process-only operation
- SQLite-only deployment path
- non-leased jobs
- non-leased connector outbox
- manually invoked review cycle
- missing lesson consolidation
- missing continuous deployment probes
- missing worker identity and heartbeat
- one-reviewer constitutional amendment decision
- non-attributable or non-atomic constitutional activation
- circular or stale embedded archive checksums
- duplicate or stale derived release manifests
- no governed GitHub improvement-PR request
- no production PostgreSQL schema matching the runtime service interface

## Deliberately external

These require operator-owned credentials or infrastructure and are not fabricated:

- OpenAI replacement API key
- Wolfram App ID
- Supabase database password or pooler URL
- Supabase service-role key for REST replication
- GitHub token or GitHub App credentials
- container registry credentials
- Kubernetes cluster admission
- external monitoring ingress and TLS
- production backup retention policy

## Still prohibited

- silent self-modification
- autonomous merge
- autonomous production promotion
- autonomous constitutional activation
- secret ingestion into evidence
- unbounded tool authority
