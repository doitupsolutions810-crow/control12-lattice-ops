#!/usr/bin/env bash
# Automated dual-CA cutover (path 4)
# Sequence: rotate → platform TLS reload → operator restarts cloudflared → finalize → reload
#
# Usage:
#   bash scripts/mtls-cutover.sh              # age-based rotate if due
#   bash scripts/mtls-cutover.sh --force
#   CONTROL12_PLATFORM_TOKEN=... bash scripts/mtls-cutover.sh --force
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORCE_ARGS=()
for a in "$@"; do
  [[ "$a" == "--force" || "$a" == "-f" ]] && FORCE_ARGS=(--force)
done

HOST="${CONTROL12_PLATFORM_HOST:-127.0.0.1}"
PORT="${CONTROL12_PLATFORM_PORT:-4400}"
TOKEN="${CONTROL12_PLATFORM_TOKEN:-}"
SCHEME=http
[[ "${CONTROL12_MTLS:-0}" == "1" ]] && SCHEME=https

reload_platform() {
  if [[ -n "$TOKEN" ]]; then
    curl -fkfsS -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "content-type: application/json" \
      "${SCHEME}://${HOST}:${PORT}/api/v1/security/tls/reload" && return 0
  fi
  # SIGHUP fallback
  if pgrep -f 'node src/server.mjs' >/dev/null 2>&1; then
    pkill -HUP -f 'node src/server.mjs' || true
    sleep 1
    return 0
  fi
  echo "warn: could not reload platform (no token curl, no pid)" >&2
  return 1
}

echo "=== [1/5] rotate ==="
bash "$ROOT/scripts/rotate-mtls-certs.sh" "${FORCE_ARGS[@]+"${FORCE_ARGS[@]}"}"

echo "=== [2/5] hot-reload platform (dual CA) ==="
reload_platform || true

echo "=== [3/5] restart cloudflared (operator) ==="
echo "Run on tunnel host:"
echo "  pkill -f 'cloudflared tunnel' || true"
echo "  cd $ROOT && npm run tunnel:named"
if [[ "${CONTROL12_CUTOVER_AUTO_TUNNEL:-0}" == "1" ]]; then
  pkill -f 'cloudflared tunnel' 2>/dev/null || true
  sleep 1
  if [[ -f "${CONTROL12_CF_CONFIG:-$ROOT/cloudflared/config.yml}" ]] || [[ -f "$HOME/.cloudflared/config.yml" ]]; then
    echo "attempting tunnel restart in background..."
    (cd "$ROOT" && bash scripts/tunnel-named.sh &) || true
    sleep 3
  fi
fi

if [[ "${CONTROL12_CUTOVER_SKIP_FINALIZE:-0}" == "1" ]]; then
  echo "skip finalize (CONTROL12_CUTOVER_SKIP_FINALIZE=1) — dual-CA still active"
  exit 0
fi

echo "=== [4/5] finalize overlap (drop ca-previous) ==="
echo "Waiting ${CONTROL12_CUTOVER_WAIT_SECS:-5}s for tunnel client cutover..."
sleep "${CONTROL12_CUTOVER_WAIT_SECS:-5}"
bash "$ROOT/scripts/finalize-mtls-overlap.sh"

echo "=== [5/5] reload platform (single CA) ==="
reload_platform || true
bash "$ROOT/scripts/verify-mtls-certs.sh" || true
echo "cutover sequence complete"
