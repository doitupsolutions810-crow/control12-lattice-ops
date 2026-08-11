# Sovereign Enterprise Runtime v4

## Enterprise structure

```text
Tenant
└── Enterprise Organization
    ├── Department
    │   ├── Service
    │   │   ├── Accountable owner
    │   │   ├── SLO policy
    │   │   ├── Budget account
    │   │   ├── Incidents
    │   │   └── Operation plans
    │   └── Mission teams
    └── Federation agreements
```

Organizations and departments are persistent. Mission teams remain temporary and capability leased.

## Budget authority

Budget changes are durable transactions:

```text
Request reserve, charge, or release
→ Capacity validation
→ Independent approval
→ Atomic account update
→ Canonical receipt
```

The requester cannot approve their own movement. Concurrent capacity changes fail closed during the final transaction.

## Incident command

```text
SLO or operator declaration
→ Independent commander appointment
→ Evidence and timeline
→ Commander requests bounded action
→ Independent action approval
→ Third-party executor claims signed command
→ Cluster-agent receipt
→ Reconciliation and resolution
```

The incident service cannot execute arbitrary shell commands. It can only use the fixed cluster-agent command vocabulary.

## Evidence graph

The append-only evidence ledger remains the integrity source. The graph adds typed relationships including supports, contradicts, derived_from, produced, approved, executed, observed, triggered, supersedes, belongs_to, owns, and allocated_to.

Every node and edge has a canonical SHA-256 digest. Graph lineage is bounded by depth and tenant.

## Federated resource exchange

A resource reservation requires four independent roles:

```text
Offer creator
→ Offer approver
→ Reservation requester
→ Reservation approver
→ Independent activator
```

Offer publication is proposal-only through a signed federation envelope. Activation reserves institutional capacity but does not directly execute an external workload.

## Maintenance windows

Operation plans contain restricted cluster commands. The plan requester, approver, and executor must be distinct. The execution claim is accepted only inside the timezone-aware maintenance window and only when `AVRONE_ENTERPRISE_OPERATION_EXECUTION=true`.

Even then, the plan merely creates approved signed cluster commands. The remote cluster agent separately authenticates, pulls, validates, executes, and receipts each command.

## Database boundary

The readiness service reports backend type, connectivity, required table presence, production backend validity, schema name, and failure type. It never returns the database URL or credentials.
