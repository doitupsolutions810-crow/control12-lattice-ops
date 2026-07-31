#!/usr/bin/env bash
# Named (persistent) cloudflared tunnel using config file.
# Credentials must live outside the repo (e.g. ~/.cloudflared/<uuid>.json) mode 600.
#
# Prerequisites:
#   cloudflared tunnel login
#   cloudflared tunnel create control12-platform
#   cloudflared tunnel route dns control12-platform platform.example.com
#   copy cloudflared/config.example.yml → cloudflared/config.yml (gitignored)
#
# Usage:
#   bash scripts/tunnel-named.sh
#   CONTROL12_CF_CONFIG=$HOME/.cloudflared/config.yml bash scripts/tunnel-named.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${CONTROL12_CF_CONFIG:-$ROOT/cloudflared/config.yml}"
CHECK="$ROOT/scripts/check-tunnel-creds.sh"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found" >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "config not found: $CONFIG" >&2
  echo "Copy cloudflared/config.example.yml → cloudflared/config.yml (gitignored)" >&2
  exit 1
fi

if [[ -x "$CHECK" ]] || [[ -f "$CHECK" ]]; then
  bash "$CHECK" "$CONFIG"
fi

# Refuse to run if credentials path still points inside repo (double-check)
CRED_LINE="$(grep -E '^[[:space:]]*credentials-file:[[:space:]]*' "$CONFIG" || true)"
CRED="$(echo "$CRED_LINE" | sed -E 's/^[[:space:]]*credentials-file:[[:space:]]*//' | tr -d '"' | tr -d "'")"
if [[ "$CRED" == ~* ]]; then
  CRED="${CRED/#\~/$HOME}"
fi
if [[ -n "$CRED" && "$CRED" == "$ROOT"/* ]]; then
  echo "refusing to start: credentials-file is inside the repository" >&2
  echo "move it to ~/.cloudflared/ and update config" >&2
  exit 1
fi

echo "running named tunnel with $CONFIG"
exec cloudflared tunnel --config "$CONFIG" run
