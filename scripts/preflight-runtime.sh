#!/usr/bin/env bash
set -euo pipefail
fail=0
for tool in curl jq openssl python3 git; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing required tool: $tool" >&2; fail=1; }
done
builder=""
for tool in docker podman buildah nerdctl; do
  if command -v "$tool" >/dev/null 2>&1; then builder="$tool"; break; fi
done
[[ -n "$builder" ]] || { echo "no builder available (docker, podman, buildah, nerdctl)" >&2; fail=1; }
case "$builder" in
  docker) docker info >/dev/null 2>&1 || { echo "docker CLI exists but daemon is unavailable" >&2; fail=1; } ;;
  podman) podman info >/dev/null 2>&1 || { echo "podman is unavailable" >&2; fail=1; } ;;
  nerdctl) nerdctl info >/dev/null 2>&1 || { echo "containerd/nerdctl is unavailable" >&2; fail=1; } ;;
  buildah) buildah info >/dev/null 2>&1 || { echo "buildah is unavailable" >&2; fail=1; } ;;
esac
[[ -n "${IMAGE_REPOSITORY:-}" ]] || { echo "IMAGE_REPOSITORY is required" >&2; fail=1; }
[[ -n "${REGISTRY_USERNAME:-}" ]] || { echo "REGISTRY_USERNAME is required" >&2; fail=1; }
[[ -n "${REGISTRY_PASSWORD_FILE:-}" && -r "${REGISTRY_PASSWORD_FILE:-}" ]] || { echo "REGISTRY_PASSWORD_FILE must reference a readable secret file" >&2; fail=1; }
[[ $fail -eq 0 ]] || exit 1
echo "runtime preflight passed; builder=$builder repository=$IMAGE_REPOSITORY"
