#!/usr/bin/env bash
set -Eeuo pipefail

ORGANIZATION="${CONTROL12_GITHUB_ORGANIZATION:-doitupsolutions810-crow}"
NAMESPACE="${CONTROL12_NAMESPACE:-control12}"
POLICY_CONTROLLER_VERSION="${POLICY_CONTROLLER_VERSION:-0.10.5}"
TRUST_POLICY_VERSION="${TRUST_POLICY_VERSION:-v0.7.0}"

for command in helm kubectl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "ERROR: $command is required" >&2
    exit 1
  }
done

kubectl version --client >/dev/null
helm version >/dev/null

helm upgrade policy-controller --install --atomic \
  --create-namespace \
  --namespace artifact-attestations \
  oci://ghcr.io/sigstore/helm-charts/policy-controller \
  --version "$POLICY_CONTROLLER_VERSION"

helm upgrade trust-policies --install --atomic \
  --namespace artifact-attestations \
  oci://ghcr.io/github/artifact-attestations-helm-charts/trust-policies \
  --version "$TRUST_POLICY_VERSION" \
  --set policy.enabled=true \
  --set policy.organization="$ORGANIZATION" \
  --set-json "policy.images=[\"ghcr.io/$ORGANIZATION/control12-**\"]"

kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || \
  kubectl create namespace "$NAMESPACE"

kubectl label namespace "$NAMESPACE" \
  policy.sigstore.dev/include=true \
  --overwrite

kubectl wait \
  --for=condition=Available \
  deployment/policy-controller-webhook \
  --namespace artifact-attestations \
  --timeout=180s

printf 'PASS: GitHub provenance enforcement enabled for namespace %s\n' "$NAMESPACE"
printf 'Trusted organization: %s\n' "$ORGANIZATION"
printf 'Enforced images: ghcr.io/%s/control12-**\n' "$ORGANIZATION"
