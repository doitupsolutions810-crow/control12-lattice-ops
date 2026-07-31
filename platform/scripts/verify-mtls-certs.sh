#!/usr/bin/env bash
# Verify mTLS material integrity and print renew status.
set -euo pipefail

DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
RENEW_DAYS="${CONTROL12_MTLS_RENEW_DAYS:-${CONTROL12_MTLS_MAX_AGE_DAYS:-60}}"
FAIL=0

ok() { echo "[ok] $*"; }
err() { echo "[fail] $*" >&2; FAIL=1; }

if [[ ! -d "$DIR" ]]; then
  err "missing dir $DIR — run npm run mtls:gen or mtls:rotate -- --force"
  exit 1
fi

for f in ca.pem ca.key server.pem server.key client.pem client.key; do
  if [[ ! -f "$DIR/$f" ]]; then
    err "missing $DIR/$f"
  else
    ok "present $f"
  fi
done

if [[ -f "$DIR/ca.pem" && -f "$DIR/server.pem" ]]; then
  if openssl verify -CAfile "$DIR/ca.pem" "$DIR/server.pem" >/dev/null; then
    ok "server chain"
  else
    err "server chain verify failed"
  fi
fi

if [[ -f "$DIR/ca.pem" && -f "$DIR/client.pem" ]]; then
  if openssl verify -CAfile "$DIR/ca.pem" "$DIR/client.pem" >/dev/null; then
    ok "client chain"
  else
    err "client chain verify failed"
  fi
fi

if [[ -f "$DIR/server.pem" ]]; then
  end="$(openssl x509 -enddate -noout -in "$DIR/server.pem" | cut -d= -f2)"
  echo "server notAfter=$end"
  secs=$((RENEW_DAYS * 86400))
  if openssl x509 -in "$DIR/server.pem" -checkend "$secs" -noout 2>/dev/null; then
    ok "outside renew window ($RENEW_DAYS days)"
  else
    err "inside renew window or expired — run npm run mtls:rotate"
  fi
fi

for key in ca.key server.key client.key; do
  if [[ -f "$DIR/$key" ]]; then
    mode="$(stat -c '%a' "$DIR/$key" 2>/dev/null || stat -f '%OLp' "$DIR/$key" 2>/dev/null || echo '?')"
    if [[ "$mode" != "600" && "$mode" != "400" ]]; then
      err "$key mode=$mode (want 600)"
    else
      ok "$key mode=$mode"
    fi
  fi
done

if [[ -f "$DIR/RELOAD_REQUIRED" ]]; then
  echo "[warn] RELOAD_REQUIRED present — restart platform and cloudflared"
fi

if [[ -f "$DIR/last-rotation.json" ]]; then
  echo "last-rotation: $(cat "$DIR/last-rotation.json")"
fi

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
echo "verify passed"
