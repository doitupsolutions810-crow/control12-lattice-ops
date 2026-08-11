#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$ROOT/package.json','utf8')).version")"
OWNER="${GHCR_OWNER:-doitupsolutions810-crow}"
IMAGE="ghcr.io/${OWNER}/control12-local-agent"
ENGINE="${CONTAINER_ENGINE:-docker}"

: "${GHCR_USER:=${OWNER}}"
: "${CR_PAT:?Set CR_PAT to a GitHub token with write:packages}"

printf '%s' "$CR_PAT" | "$ENGINE" login ghcr.io --username "$GHCR_USER" --password-stdin

"$ENGINE" tag "control12-local-agent:${VERSION}" "${IMAGE}:${VERSION}"
"$ENGINE" tag "control12-local-agent:${VERSION}" "${IMAGE}:latest"
"$ENGINE" push "${IMAGE}:${VERSION}"
"$ENGINE" push "${IMAGE}:latest"

if command -v "$ENGINE" >/dev/null 2>&1; then
  "$ENGINE" inspect "${IMAGE}:${VERSION}" 2>/dev/null || true
fi

printf 'Published %s:%s and %s:latest\n' "$IMAGE" "$VERSION" "$IMAGE"
