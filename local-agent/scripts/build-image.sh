#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT/package.json','utf8')).version")"
IMAGE="${CONTROL12_IMAGE:-control12-local-agent:${VERSION}}"
ENGINE="${CONTAINER_ENGINE:-}"

if [ -z "$ENGINE" ]; then
  for candidate in docker podman nerdctl buildah; do
    if command -v "$candidate" >/dev/null 2>&1; then
      ENGINE="$candidate"
      break
    fi
  done
fi

[ -n "$ENGINE" ] || {
  echo "ERROR: install Docker, Podman, nerdctl, or Buildah" >&2
  exit 1
}

case "$ENGINE" in
  buildah)
    buildah bud \
      --build-arg "CONTROL12_VERSION=$VERSION" \
      --tag "$IMAGE" \
      --file "$ROOT/Dockerfile" \
      "$ROOT"
    ;;
  docker|podman|nerdctl)
    "$ENGINE" build \
      --build-arg "CONTROL12_VERSION=$VERSION" \
      --tag "$IMAGE" \
      --file "$ROOT/Dockerfile" \
      "$ROOT"
    ;;
  *)
    echo "ERROR: unsupported container engine: $ENGINE" >&2
    exit 1
    ;;
esac

printf 'Built %s with %s\n' "$IMAGE" "$ENGINE"
