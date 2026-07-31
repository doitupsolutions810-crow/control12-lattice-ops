#!/usr/bin/env bash
# Named (persistent) cloudflared tunnel using config file.
# Prerequisites:
#   cloudflared tunnel login
#   cloudflared tunnel create control12-platform
#   copy cloudflared/config.example.yml → ~/.cloudflared/config.yml and fill tunnel id + credentials
#
# Usage:
#   bash scripts/tunnel-named.sh
#   CONTROL12_CF_CONFIG=/path/to/config.yml bash scripts/tunnel-named.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${CONTROL12_CF_CONFIG:-$ROOT/cloudflared/config.yml}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found" >&2
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "config not found: $CONFIG" >&2
  echo "Copy cloudflared/config.example.yml → cloudflared/config.yml and set tunnel UUID + credentials-file" >&2
  exit 1
fi

echo "running named tunnel with $CONFIG"
exec cloudflared tunnel --config "$CONFIG" run
