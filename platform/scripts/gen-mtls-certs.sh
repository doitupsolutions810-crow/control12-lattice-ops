#!/usr/bin/env bash
# Generate lab mTLS material. If already present, no-op.
# For rotation, use scripts/rotate-mtls-certs.sh instead.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"

mkdir -p "$DIR"
chmod 700 "$DIR"

if [[ -f "$DIR/ca.pem" && -f "$DIR/server.pem" && -f "$DIR/client.pem" ]]; then
  echo "certs already present in $DIR (use npm run mtls:rotate -- --force to renew)"
  bash "$ROOT/scripts/verify-mtls-certs.sh" || true
  exit 0
fi

# First mint via rotator (force) for one code path
bash "$ROOT/scripts/rotate-mtls-certs.sh" --force
echo "export CONTROL12_MTLS=1"
echo "export CONTROL12_TLS_CERT=$DIR/server.pem"
echo "export CONTROL12_TLS_KEY=$DIR/server.key"
echo "export CONTROL12_TLS_CA=$DIR/ca.pem"
echo "# cloudflared client: $DIR/client.pem + client.key"
