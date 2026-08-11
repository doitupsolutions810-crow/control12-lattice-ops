# Gap audit — Avrone v3.0.0

## Closed

- single-cluster-only control model
- direct control-plane dependence on cluster-admin credentials
- arbitrary-command risk in remote execution
- workload identity claims without an explicit trusted-verifier boundary
- SLO observations without normalized batch ingestion
- rollback proposals without governed execution records
- backups and recovery rehearsals without institutional DR drills
- static role lists without capability-based team formation
- federation messages without interoperable asymmetric signatures
- missing operator view across clusters, SLO, DR, rollback, and federation
- cluster-agent heartbeat state rejecting its own subsequent polling

## Deliberately external

- Supabase/PostgreSQL pooler password or client certificate
- real cloud OIDC trust configuration and token exchange
- admitted cluster-agent OCI digest
- Kubernetes API endpoint egress policy for each target cluster
- External Secrets and Sigstore controller installation
- real Prometheus or OTLP production endpoint
- external sovereign federation peer
- production DNS, TLS, object-store retention, and regional failover

## Still prohibited

- arbitrary remote shell execution
- requester self-approval
- autonomous rollback execution
- autonomous cluster mutation
- unverified JWT claims treated as identity proof
- long-lived cloud credentials embedded in workflows
- federation messages granting execution authority
- silent self-modification or autonomous merge
