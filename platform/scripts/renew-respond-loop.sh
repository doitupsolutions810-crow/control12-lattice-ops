#!/usr/bin/env bash
# Self-operating renew & respond (path 1)
# 1) If cert inside renew window → mtls-cutover
# 2) Always run anomaly analysis; high severity → print remediate hint (exit 1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
RENEW_DAYS="${CONTROL12_MTLS_RENEW_DAYS:-60}"
RC=0

echo "=== renew-respond-loop ==="

# Cert threshold
if [[ -f "$DIR/server.pem" ]] && command -v openssl >/dev/null; then
  secs=$((RENEW_DAYS * 86400))
  if ! openssl x509 -in "$DIR/server.pem" -checkend "$secs" -noout 2>/dev/null; then
    echo "cert within renew window — running cutover"
    bash "$ROOT/scripts/mtls-cutover.sh" || RC=1
  else
    echo "cert outside renew window"
  fi
else
  echo "no server.pem or openssl — skip cutover"
fi

echo "=== anomalies ==="
if ! bash "$ROOT/scripts/analyze-access-anomalies.sh"; then
  echo "HIGH severity — consider: npm run tunnel:remediate"
  RC=1
fi

echo "=== security status (if up) ==="
bash "$ROOT/scripts/security-status.sh" 2>/dev/null || true

exit "$RC"
