# Avrone v6 Gap Audit

## Closed in v6

- **Unversioned institutional policy:** closed with policy documents, immutable version digests, three-authority activation, and quorum amendments.
- **Mutable institutional history:** closed at the service and database layers with an append-only hash chain and update/delete rejection triggers.
- **Unbounded delegated authority:** closed with allowlisted capabilities, tenant and organization scope, expiry, maximum uses, and exhaustion.
- **Unstructured emergency power:** closed with capability and duration limits, requester/approver/activator separation, and a disabled activation gate.
- **Informal federation agreements:** closed with treaty digests, peer-attestation records, independent ratification and activation, expiry, and capability-bounded missions.
- **Accounting export ambiguity:** closed with deterministic, digest-addressed audit packages and independent export approval.
- **Reconciliation without review:** closed with immutable result digests and independent acceptance or rejection.
- **PostgreSQL event-sequence races:** closed with tenant-scoped transaction advisory locking.
- **Mutable trigger function search path:** closed by fixing the PostgreSQL trigger function `search_path`; Supabase security advisor returns zero lints.

## Preserved fail-closed boundaries

- Emergency authority activation is disabled.
- Federation treaty activation is disabled.
- Interinstitution mission execution is disabled.
- Financial execution and federation settlement remain disabled.
- Continuity, enterprise, cluster, cleanroom, agent, rollout, training, and external execution remain disabled.
- No arbitrary remote shell execution was introduced.
- No runtime secret or database URL is exposed by status endpoints.

## Remaining external requirements

- Production PostgreSQL/Supabase pooler credentials and connection admission
- Real cloud workload identity and trusted issuer configuration
- Admitted OCI images for API, worker, dashboard, and cluster agent
- Production Kubernetes cluster admission and egress policy
- Real federation peer key exchange and treaty countersignature verification
- Production SLO/OTLP ingestion
- Approved emergency and interinstitution operating procedures
- External audit retention and legally reviewed accounting export policy
- Human review and merge of the draft GitHub candidate
