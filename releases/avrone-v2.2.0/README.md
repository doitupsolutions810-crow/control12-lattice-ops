# Avrone Sovereign Fabric v2.2.0 — Resilience and Admission Fabric

This review package advances v2.1.0 with provider-neutral secret resolution, verified backup and recovery rehearsals, evidence-backed deployment admission, worker recovery, and digest-only Kubernetes resources.

## Validation targets

- Python compilation
- complete test suite: 47 passed, 0 failed
- secret-value non-disclosure
- SQLite backup verification and isolated restore rehearsal
- expired lease recovery
- independent requester, approver, and promoter enforcement
- Supabase migration and security-advisor check
- deterministic release build
- ZIP CRC, traversal, and manifest verification

## Safety boundary

No API keys, service-role credentials, database passwords, signing keys, `.env` files, or external execution results are embedded. Consequential execution gates remain disabled by default. This release must remain a draft admission until human review is complete.
