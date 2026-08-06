# Gap audit — v2.2.0

## Closed

- environment-only connector secret resolution
- secret readiness that could not identify provider source
- backup creation without durable catalog records
- backup archives without integrated verification APIs
- no non-destructive restore rehearsal
- no recovery rehearsal prerequisite for deployment admission
- deployment admission without independent requester, approver, and promoter roles
- promoter authority enforced but not persisted as durable evidence
- expired job/outbox leases recovered only during claims and not evidenced
- stale worker nodes remaining apparently healthy
- Kubernetes tag-based image examples
- no scheduled backup workload
- legacy HTTP promotion bypass
- low-level service promotion bypass
- recursive or self-embedded release checksum patterns
- stale derived external metadata included in release archives

## Deliberately external

- real OpenAI replacement key
- Wolfram App ID
- production PostgreSQL password or pooler URL
- Supabase service-role key
- GitHub App or token
- admitted OCI image digest
- Kubernetes cluster credentials
- cloud secret-store controller
- production backup object-store retention
- external TLS, DNS, and monitoring ingress

## Still prohibited

- exposing secret values through status or evidence
- restoring over an active database during rehearsal
- requester self-approval
- approver performing final promotion
- promotion without a canonical requester/approver/promoter receipt
- autonomous merge or production promotion
- autonomous constitutional activation
- unbounded agent or tool authority
