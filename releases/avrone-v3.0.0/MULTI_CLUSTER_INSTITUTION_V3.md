# Avrone v3 — Persistent Multi-Cluster Institution

## Control-plane boundary

Avrone v3 separates institutional decisions from cluster mutation. The API and general worker create governed records. A restricted cluster agent pulls only signed, expiring commands from a fixed vocabulary and returns a durable receipt.

```text
Mission / incident / rollout evidence
→ Human request
→ Independent approval
→ Signed cluster command
→ Restricted cluster-agent pull
→ Namespace and capability check
→ Optional mutation gate
→ Signed receipt
→ Evidence chain
```

Allowed cluster commands are limited to `namespace.apply`, `deployment.rollback`, `workload.restart`, and `evidence.collect`. No arbitrary shell command is accepted.

## Workload identity

The control plane records normalized identity claims only after a configured trusted verifier reports success. Parsing a token is never treated as verification. Supported trust anchors include Kubernetes TokenReview, GitHub OIDC federation, and cloud STS gateways.

The Kubernetes example projects a short-lived service-account token with the `avrone-control-plane` audience. It does not install a guessed API-server egress policy.

## SLO ingestion

The v3 SLO plane accepts normalized availability, error-rate, and p95-latency batches. It can also pull named Prometheus queries from an allowlisted host. Every metric becomes a durable service observation.

## Governed rollback

Rollback execution uses three authorities:

```text
Requester ≠ Approver ≠ Executor
```

Execution creates an approved cluster command. Mutation occurs only when a registered cluster agent receives the command and its local execution gate is enabled.

## Disaster recovery

A DR drill requires a verified backup, a passed non-destructive recovery rehearsal, an active cluster agent, independent approval, and an independent drill operator. The included drill does not overwrite an active database.

## Dynamic teams

Mission teams can be formed from requested capabilities. The scheduler chooses a minimal role set, then adds governor and verifier roles before issuing normal bounded capability leases and budget.

## Federation v2

Federation peers use Ed25519 public keys and allowlisted message types. Envelopes are proposal-only and do not grant remote execution authority. Verified inbound messages receive durable receipts.
