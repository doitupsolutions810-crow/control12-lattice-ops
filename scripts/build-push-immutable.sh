#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/preflight-runtime.sh"
CONTEXT_DIR="${CONTEXT_DIR:-/workspace/source/approved-runner}"
DOCKERFILE="${DOCKERFILE:-$CONTEXT_DIR/runner/image/Dockerfile}"
TAG="${IMAGE_TAG:-build-$(date -u +%Y%m%d%H%M%S)}"
IMAGE="${IMAGE_REPOSITORY}:${TAG}"
REGISTRY_HOST="${IMAGE_REPOSITORY%%/*}"
password="$(cat "$REGISTRY_PASSWORD_FILE")"
trap 'unset password' EXIT
builder=""
for candidate in docker podman buildah nerdctl; do command -v "$candidate" >/dev/null 2>&1 && { builder="$candidate"; break; }; done
case "$builder" in
 docker)
   printf '%s' "$password" | docker login "$REGISTRY_HOST" -u "$REGISTRY_USERNAME" --password-stdin
   docker buildx build --file "$DOCKERFILE" --tag "$IMAGE" --sbom=true --provenance=mode=max --push "$CONTEXT_DIR"
   ;;
 podman)
   printf '%s' "$password" | podman login "$REGISTRY_HOST" -u "$REGISTRY_USERNAME" --password-stdin
   podman build --file "$DOCKERFILE" --tag "$IMAGE" "$CONTEXT_DIR"
   podman push "$IMAGE"
   ;;
 buildah)
   printf '%s' "$password" | buildah login "$REGISTRY_HOST" -u "$REGISTRY_USERNAME" --password-stdin
   buildah bud --file "$DOCKERFILE" --tag "$IMAGE" "$CONTEXT_DIR"
   buildah push "$IMAGE"
   ;;
 nerdctl)
   printf '%s' "$password" | nerdctl login "$REGISTRY_HOST" -u "$REGISTRY_USERNAME" --password-stdin
   nerdctl build --file "$DOCKERFILE" --tag "$IMAGE" "$CONTEXT_DIR"
   nerdctl push "$IMAGE"
   ;;
esac
command -v crane >/dev/null 2>&1 || { echo "crane is required to resolve registry digest" >&2; exit 1; }
digest="$(crane digest "$IMAGE")"
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "invalid digest: $digest" >&2; exit 1; }
immutable="${IMAGE_REPOSITORY}@${digest}"
if [[ -n "${COSIGN_KEY:-}" ]]; then
  cosign sign --yes --key "$COSIGN_KEY" "$immutable"
  if [[ -n "${COSIGN_PUBLIC_KEY:-}" ]]; then cosign verify --key "$COSIGN_PUBLIC_KEY" "$immutable" >/dev/null; fi
fi
mkdir -p "${OUTPUT_DIR:-/workspace/state}"
printf '%s\n' "$immutable" | tee "${OUTPUT_DIR:-/workspace/state}/immutable-reference.txt"
printf '{"image":"%s","digest":"%s","immutable_reference":"%s","builder":"%s"}\n' "$IMAGE" "$digest" "$immutable" "$builder" > "${OUTPUT_DIR:-/workspace/state}/build-result.json"
echo "published: $immutable"
