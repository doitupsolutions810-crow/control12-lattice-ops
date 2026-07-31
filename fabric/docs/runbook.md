# Operations runbook

1. Verify `/health`, `/ready`, and `/metrics`.
2. Run `node cli.mjs token` only on an administrative host with `CONTROL12_FABRIC_SECRET` loaded from a secret manager.
3. Inspect `/api/v2/events` and run ledger verification through `/ready` before promotion.
4. Require separate approvers for production plugin and deployment actions.
5. Use immutable `image@sha256:<digest>` references in Kubernetes and deployment plans.
6. Back up the state and ledger directories atomically; test restoration before pruning old backups.
7. Rotate the fabric secret by issuing replacement tokens, updating secrets, and restarting all replicas in a bounded rollout.
