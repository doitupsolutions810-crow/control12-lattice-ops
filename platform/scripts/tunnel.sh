#!/usr/bin/env bash
# Quick cloudflared tunnel → CONTROL12 platform (default http://127.0.0.1:4400)
# Usage:
#   bash scripts/tunnel.sh
#   CONTROL12_PLATFORM_PORT=4400 bash scripts/tunnel.sh
#
# Prints a https://*.trycloudflare.com URL for CONTROL12_PLATFORM_URL on Vercel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${CONTROL12_PLATFORM_PORT:-4400}"
HOST="${CONTROL12_TUNNEL_TARGET_HOST:-127.0.0.1}"
TARGET="http://${HOST}:${PORT}"
URL_FILE="${CONTROL12_TUNNEL_URL_FILE:-$ROOT/.control12-platform/tunnel-url.txt}"
LOG_FILE="${CONTROL12_TUNNEL_LOG:-$ROOT/.control12-platform/tunnel.log}"

mkdir -p "$(dirname "$URL_FILE")"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install:" >&2
  echo "  macOS:  brew install cloudflare/cloudflare/cloudflared" >&2
  echo "  Linux:  https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" >&2
  exit 1
fi

if ! curl -fsS --max-time 2 "${TARGET}/health" >/dev/null 2>&1; then
  echo "warning: ${TARGET}/health not reachable yet — start the platform first (npm start)" >&2
  echo "  recommended: CONTROL12_CHAT_OPEN=1 npm start" >&2
fi

echo "tunneling ${TARGET}"
echo "URL will be written to ${URL_FILE} when ready"
echo "Set Vercel CONTROL12_PLATFORM_URL to that https URL"
echo "---"

# cloudflared quick tunnels log the public URL to stderr
# Pattern: https://*.trycloudflare.com
cloudflared tunnel --no-autoupdate --url "${TARGET}" 2>&1 | tee "${LOG_FILE}" | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" =~ https://[a-zA-Z0-9.-]+\.trycloudflare\.com ]]; then
    url="$(echo "$line" | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | head -1)"
    if [[ -n "$url" ]]; then
      printf '%s\n' "$url" > "$URL_FILE"
      echo "[control12] public URL: $url" >&2
      echo "[control12] export CONTROL12_PLATFORM_URL=$url" >&2
    fi
  fi
done
