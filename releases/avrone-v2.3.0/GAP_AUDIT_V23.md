# Gap audit — v2.3.0

## Closed

- mutable OCI references accepted as release evidence
- SBOM/provenance receipts without runtime parsing
- OCI registrant able to self-admit
- deployment promotion without an admitted image digest
- promotion without a passed canary rollout
- missing required canary SLO observations
- automatic rollback on metric breach
- low-level service promotion bypass
- no multi-architecture GHCR publication workflow
- no GitHub artifact attestation and Cosign verification workflow
- no External Secrets v1 production resource
- no Sigstore image identity policy template
- rollout application sharing broad API service-account authority

## Deliberately external

- an actually published GHCR digest
- GitHub protected-environment approval
- live GitHub attestation records
- live Rekor/Fulcio verification evidence
- External Secrets and Sigstore Policy Controller installation
- Vault address, role, and secret paths
- Kubernetes admission and rollout execution
- production traffic routing and metrics integration

## Still prohibited

- mutable-tag admission
- self-admission of OCI artifacts
- promotion without recovery and canary evidence
- automatic rollback execution
- unrestricted Kubernetes credentials in API or worker pods
- autonomous merge or production promotion
- secret disclosure in status or evidence
