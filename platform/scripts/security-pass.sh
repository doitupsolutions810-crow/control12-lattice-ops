#!/usr/bin/env bash
# One-shot tunnel security pass: credentials, access anomalies, optional cert rotate.
# Usage:
#   bash scripts/security-pass.sh
#   CONTROL12_SECURITY_ROTATE=1 bash scripts/security-pass.sh   # also force-age rotate check
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RC=0

echo "======== CONTROL12 security pass ========"
echo

echo "--- tunnel credential check ---"
if bash scripts/check-tunnel-creds.sh 2>/dev/null; then
  echo "creds: ok"
else
  echo "creds: skipped or failed (no named config is OK for quick tunnels)"
fi
echo

echo "--- access log anomalies ---"
if bash scripts/analyze-access-anomalies.sh; then
  echo "anomalies: clean or non-high"
else
  echo "anomalies: HIGH severity detected"
  RC=1
fi
echo

if [[ "${CONTROL12_SECURITY_ROTATE:-0}" == "1" ]]; then
  echo "--- mTLS rotation check ---"
  bash scripts/rotate-mtls-certs.sh || true
  echo
fi

echo "--- parse summary ---"
bash scripts/parse-access-log.sh "${CONTROL12_ACCESS_LOG:-}" summary 2>/dev/null || \
  bash scripts/parse-access-log.sh summary 2>/dev/null || \
  echo "(no access log yet)"
echo

echo "======== pass complete rc=$RC ========"
exit "$RC"
