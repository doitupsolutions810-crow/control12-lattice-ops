#!/usr/bin/env bash
# Remediation checklist + assisted steps when tunnel credentials may be leaked.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${CONTROL12_PLATFORM_ROOT:-$ROOT/.control12-platform}"

echo "=============================================="
echo " CONTROL12 leaked tunnel credential remediation"
echo "=============================================="
echo
echo "1. STOP exposure"
echo "   pkill -f 'cloudflared tunnel' || true"
echo "   # stop platform if CHAT_OPEN was enabled without token"
echo
echo "2. REVOKE Cloudflare tunnel"
echo "   cloudflared tunnel list"
echo "   cloudflared tunnel delete <NAME_OR_UUID>"
echo "   # Zero Trust dashboard: delete Access apps for the hostname"
echo
echo "3. ROTATE local tunnel credentials"
echo "   rm -f ~/.cloudflared/<OLD_UUID>.json"
echo "   # optional re-login:"
echo "   #   mv ~/.cloudflared/cert.pem ~/.cloudflared/cert.pem.compromised.\$(date +%Y%m%d)"
echo "   #   cloudflared tunnel login"
echo "   cloudflared tunnel create control12-platform"
echo "   chmod 600 ~/.cloudflared/*.json ~/.cloudflared/cert.pem"
echo
echo "4. ROTATE platform token"
NEW_TOKEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)"
echo "   export CONTROL12_PLATFORM_TOKEN=$NEW_TOKEN"
echo "   # Update Vercel CONTROL12_PLATFORM_TOKEN"
echo "   # Unset CONTROL12_CHAT_OPEN on public hostnames"
echo
echo "5. ROTATE mTLS (automated)"
echo "   bash $ROOT/scripts/rotate-mtls-certs.sh --force"
echo "   # restart platform + update cloudflared client cert paths"
echo
echo "6. AUDIT + ANOMALIES"
echo "   bash $ROOT/scripts/audit-access-logs.sh"
echo "   bash $ROOT/scripts/analyze-access-anomalies.sh"
echo "   bash $ROOT/scripts/parse-access-log.sh summary"
echo "   bash $ROOT/scripts/parse-access-log.sh sensitive"
echo
echo "7. REBUILD tunnel"
echo "   # update config.yml with new UUID + credentials-file"
echo "   cloudflared tunnel route dns control12-platform <hostname>"
echo "   bash $ROOT/scripts/check-tunnel-creds.sh"
echo "   npm run tunnel:named"
echo
echo "8. VERIFY"
echo "   curl -fsS https://<hostname>/health"
echo "   bash $ROOT/scripts/security-pass.sh"
echo
echo "--- writing local remediation marker ---"
mkdir -p "$STATE"
printf '%s\n' "{\"remediationStartedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATE/remediation-last.json"
chmod 600 "$STATE/remediation-last.json" 2>/dev/null || true
echo "Wrote $STATE/remediation-last.json"
echo "Execute steps 1–8 in order."
