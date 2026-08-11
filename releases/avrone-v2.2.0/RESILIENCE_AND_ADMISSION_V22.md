# Resilience and Admission v2.2

## Backup flow

```text
Operator request
→ Online SQLite backup or PostgreSQL custom dump
→ Copy governed artifact roots
→ Per-file backup manifest
→ Compressed archive
→ Archive SHA-256
→ Durable backup catalog record
→ Evidence event
```

## Recovery rehearsal

A rehearsal extracts only regular files into a temporary directory. Absolute paths, parent traversal, symlinks, hardlinks, and device members are rejected.

SQLite rehearsals run `PRAGMA integrity_check` and require at least one table. PostgreSQL rehearsals inspect the custom dump catalog with `pg_restore --list`. Neither path writes to the active database.

## Deployment admission

Admission is blocked unless all required checks pass:

1. Deployment exists for the tenant and is healthy.
2. Environment matches the staged deployment.
3. ZIP CRC is valid and no member traverses outside the archive root.
4. Archive SHA-256 matches the supplied digest.
5. Evaluation exists and passed.
6. Rollback plan is non-empty.
7. A recovery rehearsal for the selected backup passed.
8. Constitutional deployment review allows the request.

The requester, approver, and final promoter must be three distinct authorities. Legacy promotion routes are denied, and the low-level organization service requires a claimed admission record.

## Promotion evidence

Promotion is claimed atomically. The admission record persists:

- `promoted_by`
- `promoted_at`
- `promotion_receipt`

The canonical `avrone.deployment-promotion-receipt/v1` binds the admission, tenant, deployment, requester, approver, promoter, archive digest, evaluation, backup, claim time, completion time, and final outcome. A consumed admission cannot be replayed.

## Secret-provider boundary

Secret resolution order is explicit. Status returns only names, presence, and source. File secrets must be regular, non-symlink files inside the configured root and smaller than 64 KiB.

## Worker recovery

Before processing new work, each worker:

- requeues expired running jobs
- returns expired delivering outbox items to retry
- marks sufficiently stale worker nodes offline
- records a durable worker-recovery receipt
- renews its own heartbeat and lease
