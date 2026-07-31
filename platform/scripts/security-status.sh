#!/usr/bin/env bash
# CLI mirror of GET /api/v1/security/status (via curl when platform is up).
set -euo pipefail
HOST="${CONTROL12_PLATFORM_HOST:-127.0.0.1}"
PORT="${CONTROL12_PLATFORM_PORT:-4400}"
SCHEME=http
if [[ "${CONTROL12_MTLS:-0}" == "1" ]]; then SCHEME=https; fi
URL="${CONTROL12_SECURITY_STATUS_URL:-${SCHEME}://${HOST}:${PORT}/api/v1/security/status}"

if curl -fkfsS "$URL" 2>/dev/null; then
  exit 0
fi

echo "platform not reachable at $URL — run anomaly script offline instead:" >&2
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/analyze-access-anomalies.sh" || true
