# Avrone v6 — Sovereign Institutional Operating Network

Avrone v6 extends the v5 institutional intelligence and economic fabric with enforceable constitutional versioning, bounded delegated authority, fail-closed emergency powers, an append-only institutional event log, treaty-governed federation missions, and deterministic audit/reconciliation evidence.

## Constitutional path

```text
Policy proposal
→ Independent ratification
→ Independent activation
→ Active version
→ Amendment proposal
→ Quorum votes
→ Independent amendment activation
→ New active version
```

A proposer may not ratify their own policy. The proposer and ratifier may not activate it. Amendment proposers may not vote, activation requires the configured quorum, rejecting votes block activation, and the activator must not be the proposer or an approving voter.

## Institutional event log

Each event commits to tenant sequence, event and subject type, subject identifier, canonical payload, actor, previous hash, and creation time. The service verifies the complete chain and creates duplicate-last binary SHA-256 Merkle checkpoints over bounded ranges. SQLite and PostgreSQL install triggers that reject updates and deletes. PostgreSQL sequence allocation uses a tenant-scoped transaction advisory lock.

## Delegated and emergency authority

Delegated authority is represented by expiring, use-bounded leases with allowlisted capabilities and organizational scope. Authority cannot be self-granted. Emergency authority requires requester, approver, and activator separation and remains disabled unless `AVRONE_EMERGENCY_AUTHORITY_ACTIVATION=true` is independently admitted.

## Federation treaties

Treaties bind canonical terms and a digest to an active federation peer, local proposer, independent ratifier, peer-attestation record, independent activator, effective interval, and allowlisted mission capabilities. Treaty activation and mission execution remain separate disabled gates.

## Audit and reconciliation

Audit exports require requester, approver, and exporter separation. Deterministic payloads contain bounded posted journals and institutional-event references. Reconciliation verifies posted journal balance and requires independent review.

## Default gates

```text
AVRONE_EMERGENCY_AUTHORITY_ACTIVATION=false
AVRONE_FEDERATION_TREATY_ACTIVATION=false
AVRONE_INTERINSTITUTION_EXECUTION=false
AVRONE_FINANCIAL_EXECUTION=false
AVRONE_FEDERATED_SETTLEMENT_EXECUTION=false
AVRONE_CONTINUITY_EXECUTION=false
AVRONE_ENTERPRISE_OPERATION_EXECUTION=false
AVRONE_CLUSTER_COMMAND_EXECUTION=false
ALLOW_EXTERNAL_EXECUTION=false
```

This release does not claim production banking, public hosting, real external treaty activation, external federation mission execution, production cluster mutation, cloud OIDC exchange, a production PostgreSQL pooler connection, or production traffic operation.
