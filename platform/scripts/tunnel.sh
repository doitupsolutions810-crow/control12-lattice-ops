#!/usr/bin/env bash
# Quick cloudflared tunnel → CONTROL12 platform (default http://127.0.0.1:4400)
# Ephemeral trycloudflare.com URL — no long-lived credentials file required.
# Still: do not commit tunnel-url.txt; rotate platform token if URL was shared widely.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${CONTROL12_PLATFORM_PORT:-4400}"
HOST="${CONTROL12_TUNNEL_TARGET_HOST:-127.0.0.1}"
TARGET="http://${HOST}:${PORT}"
STATE_DIR="${CONTROL12_PLATFORM_ROOT:-$ROOT/.control12-platform}"
URL_FILE="${CONTROL12_TUNNEL_URL_FILE:-$STATE_DIR/tunnel-url.txt}"
LOG_FILE="${CONTROL12_TUNNEL_LOG:-$STATE_DIR/tunnel.log}"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR" 2>/dev/null || true

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install:" >&2
  echo "  macOS:  brew install cloudflare/cloudflare/cloudflared" >&2
  echo "  Linux:  https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" >&2
  exit 1
fi

if ! curl -fsS --max-time 2 "${TARGET}/health" >/dev/null 2>&1; then
  echo "warning: ${TARGET}/health not reachable yet — start the platform first" >&2
  echo "  recommended: npm run start:chat-open" >&2
fi

echo "tunneling ${TARGET}"
echo "URL file: ${URL_FILE} (gitignored under .control12-platform/)"
echo "---"

cloudflared tunnel --no-autoupdate --url "${TARGET}" 2>&1 | tee "${LOG_FILE}" | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" =~ https://[a-zA-Z0-9.-]+\.trycloudflare\.com ]]; then
    url="$(echo "$line" | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | head -1)"
    if [[ -n "$url" ]]; then
      umask 077
      printf '%s\n' "$url" > "$URL_FILE"
      chmod 600 "$URL_FILE" 2>/dev/null || true
      echo "[control12] public URL: $url" >&2
      echo "[control12] export CONTROL12_PLATFORM_URL=$url" >&2
    fi
  fi
done
