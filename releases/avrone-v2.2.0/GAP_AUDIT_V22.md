# Gap audit — v2.2.0

## Closed

- environment-only connector secret resolution
- secret readiness that could not identify provider source
- backup creation without durable catalog records
- backup archives without integrated verification APIs
- no non-destructive restore rehearsal
- no recovery rehearsal prerequisite for deployment admission
- deployment admission without independent requester, approver, and promoter roles
- expired job/outbox leases recovered only during claims and not evidenced
- stale worker nodes remaining apparently healthy
- Kubernetes tag-based image examples
- no scheduled backup workload
- recursive or self-embedded release checksum patterns

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
- autonomous merge or production promotion
- autonomous constitutional activation
- unbounded agent or tool authority
