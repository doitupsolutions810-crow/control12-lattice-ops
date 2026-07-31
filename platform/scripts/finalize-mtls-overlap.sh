#!/usr/bin/env bash
# End dual-CA overlap: remove ca-previous.pem after cloudflared uses the new client cert.
set -euo pipefail
DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
PREV="$DIR/ca-previous.pem"

if [[ ! -f "$PREV" ]]; then
  echo "no ca-previous.pem — overlap already clear"
  exit 0
fi

# Optional safety: verify new client still chains to current ca
if [[ -f "$DIR/ca.pem" && -f "$DIR/client.pem" ]]; then
  openssl verify -CAfile "$DIR/ca.pem" "$DIR/client.pem"
fi

rm -f "$PREV"
echo "removed $PREV"
touch "$DIR/RELOAD_REQUIRED"
echo "RELOAD_REQUIRED set — hot-reload platform to drop previous CA from trust store"
echo "  kill -HUP <platform-pid>"
echo "  or POST /api/v1/security/tls/reload"
