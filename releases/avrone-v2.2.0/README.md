# Avrone Sovereign Fabric v2.2.0 — Resilience and Independent Deployment Admission

This review package records the v2.2 evolution of Avrone into a recovery-tested and independently admitted operational institution.

## Added

- provider-neutral secret resolution without value disclosure
- durable backup records and archive verification
- isolated SQLite/PostgreSQL recovery rehearsals
- worker lease and stale-node recovery evidence
- safe release archive and exact-digest verification
- recovery rehearsal as a mandatory deployment-admission gate
- three distinct release authorities: requester, approver, promoter
- service-layer and API-layer promotion bypass closure
- persisted promoter identity, timestamp, and canonical promotion receipt
- digest-pinned Kubernetes examples, image admission, mounted secret files, and backup CronJob

## Validation

- Python compilation: PASS
- Tests: 47 passed, 0 failed
- Standalone resilience demonstration: PASS
- Clean live API + separate worker: PASS on port 18093
- Backup verification and isolated recovery: PASS
- Legacy promotion denied: PASS
- Requester self-approval denied: PASS
- Approver final promotion denied: PASS
- Independent promotion and receipt persistence: PASS
- Supabase migrations applied: PASS
- Supabase runtime tables/policies: 41/41
- Promotion-evidence columns: 3
- Supabase security lints: 0
- Deterministic double build: PASS
- Embedded credential scan: PASS

## Canonical archive

`avrone-sovereign-fabric-v2.2.0.zip`

SHA-256: `7c639e687bf09410e1edc74740040e51c42ea5bbfbe9b9644d50e2a229e17243`

Archive members: 115. Manifest-tracked source files: 114. Source-tree SHA-256: `0784ddcb8ffd1fa847396cce5fa80a8cf4a217add11484ee7255b7493a3869db`.

The checksum is distributed beside the ZIP, not embedded inside it. The archive contains one authoritative file manifest and excludes derived external release metadata.

## Safety boundary

No credentials or runtime secrets are committed. External execution and all consequential execution gates remain disabled by default. This branch is intentionally proposed through a draft pull request; merge, cluster admission, external connector delivery, and production promotion remain separate human decisions.
