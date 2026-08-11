# Supply chain and canary deployment fabric — v2.3

## Trust path

```text
Reviewed source commit
→ tested multi-architecture OCI build
→ immutable registry digest
→ SPDX SBOM
→ SLSA provenance
→ GitHub artifact attestations
→ keyless Cosign signature
→ independent CLI verification
→ Avrone OCI registration
→ independent OCI admission
→ recovery-backed deployment admission
→ independent canary operator
→ required SLO observations at 5/25/50/100%
→ independent final promotion
```

No mutable tag is accepted by the runtime supply-chain service. The persisted OCI admission receipt binds the digest, source repository, source commit, workflow identity, SBOM, provenance, verifier receipt, registrant, and independent approver.

## GitHub publication boundary

`.github/workflows/oci-release.yml` is manually dispatched and protected by the `production-supply-chain` environment. Publishing is a separate Boolean input and uses the repository-scoped `GITHUB_TOKEN`; source tests and deterministic packaging run before registry access.

The workflow enables BuildKit SBOM and maximum provenance, creates GitHub registry attestations, keyless-signs the exact digest with Cosign, and runs an independent verification command before saving review evidence.

## Cluster admission boundary

The production overlay combines three layers:

1. Kubernetes CEL policy rejects mutable container references.
2. Sigstore Policy Controller verifies the GitHub Actions identity and required attestations.
3. Avrone's own admission service requires an independently admitted OCI record and recovery evidence.

The included Sigstore policy is an installation-time template. Operators must validate CRD compatibility against the installed policy-controller release before applying it.

## Canary boundary

The canary operator must be distinct from the release requester and admission approver. Each configured traffic step requires current values for availability, error rate, and p95 latency. Missing evidence blocks progress. A threshold breach creates a rollback proposal; it never applies a rollback automatically.

`ALLOW_ROLLOUT_APPLY` remains false for API and worker pods. A dedicated, suspended Job template carries narrowly scoped RBAC and must be instantiated by an operator after admission.

## Secret boundary

The production overlay uses `external-secrets.io/v1`. Secret values are written to a Kubernetes Secret and mounted only into the server-side runtime. Avrone status surfaces presence and provider source, not values.

## Remaining operator-controlled dependencies

- protected GitHub environment approval
- GHCR package permissions
- External Secrets Operator installation and Vault configuration
- Sigstore Policy Controller installation
- admitted controller and application image digests
- Kubernetes cluster credentials and network policy adaptation
- external metrics source feeding canary observations

## Cluster-specific API egress

The rollout controller starts behind the base default-deny NetworkPolicy. The production kustomization intentionally does **not** install a guessed API-server egress rule. Before unsuspending a rollout Job, the operator must add a cluster-specific egress policy for the actual Kubernetes API endpoint. `infra/k8s/production/networkpolicy.example.yaml` is a non-applied template and must not be used unchanged.
