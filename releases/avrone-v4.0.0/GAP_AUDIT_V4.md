# Gap audit — Avrone v4.0.0

## Closed in v4

- transient projects without permanent enterprise structure
- services without an accountable owner
- budget limits without independently approved movements
- SLO evidence without an incident-command object
- incident response without a durable event timeline
- remediation plans that could bypass restricted cluster commands
- append-only evidence without graph lineage
- federation messages without capacity reservation accounting
- resource activation without four-authority separation
- maintenance commands without a declared execution window
- database health responses that could disclose connection material

## Deliberately external

- production Supabase pooler password or connection URL
- real Kubernetes cluster enrollment and network egress policy
- GHCR image publication and live Sigstore attestations
- cloud OIDC trust configuration
- external Prometheus or OTLP endpoints
- external federation peer
- production DNS, TLS, ingress, and backup object storage
- human reviewer assignment for GitHub admission

## Still prohibited

- arbitrary remote shell execution
- self-approval of budget movements
- incident declarer appointing themselves commander
- commander approving or executing their own remediation
- offer creator approving a resource reservation
- reservation approver activating the same reservation
- maintenance execution outside its declared window
- exposing secrets or database URLs through readiness APIs
- autonomous merge, production promotion, or constitutional activation
