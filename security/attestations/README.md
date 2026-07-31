# CONTROL12 verification-attestation policy

## Approval state

The local runtime readiness gate is approved only for the evidence record in which all five deterministic roles returned `READY` and `failedGates` was empty.

That readiness approval does not automatically approve any container image. Every releasable CONTROL12 image must independently satisfy all of these controls:

1. The image is published to `ghcr.io/doitupsolutions810-crow/`.
2. The deployment reference contains the exact `sha256` digest.
3. The publishing workflow generates a GitHub artifact attestation for the fully qualified image name and exact digest.
4. The attestation is attached to the registry with `push-to-registry: true`.
5. The same workflow runs `gh attestation verify` against the immutable image and this repository.
6. Production Kubernetes namespaces enforce the organization trust policy through the Sigstore Policy Controller.

## Security value

A successful verification proves that the image digest is covered by a signed provenance statement issued from GitHub Actions and associated with the trusted repository identity. It detects substitution of an unattested digest and rejects images that do not match the configured organization policy.

It does not prove that the source code is free from vulnerabilities, that every dependency is safe, or that runtime configuration is secure. Vulnerability scanning, policy review, tests, least privilege, digest pinning, and runtime controls remain separate mandatory gates.

## Enforce in Kubernetes

Prerequisites:

- Kubernetes 1.27 or later
- Helm 3 or later
- `kubectl` access with permission to install cluster-scoped policy resources

Run:

```bash
bash security/attestations/enforce-control12.sh
```

The script installs pinned chart versions, trusts attestations from `doitupsolutions810-crow`, restricts matching to CONTROL12 GHCR images, and labels the `control12` namespace with:

```yaml
policy.sigstore.dev/include: "true"
```

No policy is enforced in an unlabeled namespace.

## Verify an immutable image manually

```bash
gh attestation verify \
  oci://ghcr.io/doitupsolutions810-crow/control12-sovereign-fabric@sha256:<digest> \
  --repo doitupsolutions810-crow/control12-lattice-ops
```

Verification failure is a release and deployment blocker.

## Private repository availability

GitHub-hosted artifact attestations for private or internal repositories require a GitHub plan that supports them. If the repository plan does not permit private-repository attestations, the workflow must fail closed; do not convert a failed attestation step into a warning or skip production admission enforcement.
