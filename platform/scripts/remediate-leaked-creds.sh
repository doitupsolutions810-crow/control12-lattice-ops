#!/usr/bin/env bash
# Remediation checklist + assisted steps when tunnel credentials may be leaked.
# Does NOT call Cloudflare API (requires human login). Prints ordered actions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${CONTROL12_PLATFORM_ROOT:-$ROOT/.control12-platform}"

echo "=============================================="
echo " CONTROL12 leaked tunnel credential remediation"
echo "=============================================="
echo
echo "1. STOP exposure"
echo "   - Kill cloudflared: pkill -f 'cloudflared tunnel' || true"
echo "   - Stop platform if CHAT_OPEN was enabled without token"
echo
echo "2. REVOKE Cloudflare tunnel"
echo "   cloudflared tunnel list"
echo "   cloudflared tunnel cleanup <NAME_OR_UUID>"
echo "   cloudflared tunnel delete <NAME_OR_UUID>"
echo "   # In Zero Trust dashboard: delete Access apps bound to the hostname"
echo
echo "3. ROTATE local credentials"
echo "   rm -f ~/.cloudflared/<OLD_UUID>.json"
echo "   # Optionally rotate login cert (re-login):"
echo "   #   mv ~/.cloudflared/cert.pem ~/.cloudflared/cert.pem.compromised.\$(date +%Y%m%d)"
echo "   #   cloudflared tunnel login"
echo "   cloudflared tunnel create control12-platform"
echo "   chmod 600 ~/.cloudflared/*.json ~/.cloudflared/cert.pem"
echo
echo "4. ROTATE platform token"
NEW_TOKEN="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)"
echo "   export CONTROL12_PLATFORM_TOKEN=$NEW_TOKEN"
echo "   # Update Vercel env CONTROL12_PLATFORM_TOKEN to the same value"
echo "   # Unset CONTROL12_CHAT_OPEN on any public hostname"
echo
echo "5. ROTATE mTLS material (if used)"
echo "   rm -rf ~/.control12-mtls && bash $ROOT/scripts/gen-mtls-certs.sh"
echo "   # Update cloudflared origin client cert/key paths"
echo
echo "6. AUDIT access logs"
echo "   bash $ROOT/scripts/audit-access-logs.sh"
echo "   # Look for unexpected remotes, 401 spikes, code/* hits"
echo
echo "7. REBUILD tunnel"
echo "   # Update config.yml with new UUID + credentials-file"
echo "   cloudflared tunnel route dns control12-platform <hostname>"
echo "   npm run tunnel:check && npm run tunnel:named"
echo
echo "8. VERIFY"
echo "   curl -fsS https://<hostname>/health"
echo "   # Confirm Vercel CONTROL12_PLATFORM_URL still correct"
echo "   # Confirm CHAT_OPEN=0 and bearer required"
echo
echo "--- optional: mark local state ---"
mkdir -p "$STATE"
printf '%s\n' "{\"remediationStartedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"newTokenHint\":\"set in shell above\"}" > "$STATE/remediation-last.json"
chmod 600 "$STATE/remediation-last.json" 2>/dev/null || true
echo "Wrote $STATE/remediation-last.json"
echo "Done printing runbook. Execute steps 1–8 in order."
