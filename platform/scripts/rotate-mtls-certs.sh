#!/usr/bin/env bash
# Rotate origin mTLS with dual-CA overlap support.
#
# Before swap: copies live ca.pem → ca-previous.pem (kept for trust overlap).
# New CA/server/client minted in stage, verified, swapped into stable paths.
# Platform hot-reloads via setSecureContext (SIGHUP or POST .../tls/reload).
# cloudflared must pick up new client.pem before ca-previous is dropped.
#
# Finalize overlap later:
#   bash scripts/finalize-mtls-overlap.sh
set -euo pipefail

DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
RENEW_DAYS="${CONTROL12_MTLS_RENEW_DAYS:-${CONTROL12_MTLS_MAX_AGE_DAYS:-60}}"
DAYS_VALID="${CONTROL12_MTLS_DAYS:-825}"
CN_SERVER="${CONTROL12_MTLS_SERVER_CN:-control12-platform.local}"
CN_CLIENT="${CONTROL12_MTLS_CLIENT_CN:-cloudflared-origin}"
KEEP_BACKUPS="${CONTROL12_MTLS_KEEP_BACKUPS:-5}"
FORCE=0
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --help|-h)
      echo "Usage: $0 [--force]"; exit 0 ;;
  esac
done

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 1
fi

need_rotate() {
  if [[ "$FORCE" -eq 1 ]]; then echo "decision: force"; return 0; fi
  if [[ ! -f "$DIR/server.pem" ]]; then echo "decision: missing server.pem"; return 0; fi
  local secs=$((RENEW_DAYS * 86400))
  if openssl x509 -in "$DIR/server.pem" -checkend "$secs" -noout 2>/dev/null; then
    echo "decision: not due (renew_days=$RENEW_DAYS)"
    return 1
  fi
  echo "decision: within renew window"
  return 0
}

if ! need_rotate; then exit 0; fi

mkdir -p "$DIR" && chmod 700 "$DIR"
STAGE="$DIR/stage-$STAMP"
BACKUP="$DIR/backup-$STAMP"
rm -rf "$STAGE"
mkdir -p "$STAGE" && chmod 700 "$STAGE"

cleanup_stage() { rm -rf "$STAGE"; }
trap cleanup_stage EXIT

echo "minting in $STAGE"
openssl genrsa -out "$STAGE/ca.key" 4096
openssl req -x509 -new -nodes -key "$STAGE/ca.key" -sha256 -days "$DAYS_VALID" -out "$STAGE/ca.pem" \
  -subj "/CN=control12-dev-ca-$STAMP"
openssl genrsa -out "$STAGE/server.key" 2048
openssl req -new -key "$STAGE/server.key" -out "$STAGE/server.csr" -subj "/CN=${CN_SERVER}"
openssl x509 -req -in "$STAGE/server.csr" -CA "$STAGE/ca.pem" -CAkey "$STAGE/ca.key" -CAcreateserial \
  -out "$STAGE/server.pem" -days "$DAYS_VALID" -sha256
openssl genrsa -out "$STAGE/client.key" 2048
openssl req -new -key "$STAGE/client.key" -out "$STAGE/client.csr" -subj "/CN=${CN_CLIENT}"
openssl x509 -req -in "$STAGE/client.csr" -CA "$STAGE/ca.pem" -CAkey "$STAGE/ca.key" -CAcreateserial \
  -out "$STAGE/client.pem" -days "$DAYS_VALID" -sha256

chmod 600 "$STAGE/ca.key" "$STAGE/server.key" "$STAGE/client.key"
chmod 644 "$STAGE/ca.pem" "$STAGE/server.pem" "$STAGE/client.pem"
rm -f "$STAGE"/*.csr "$STAGE"/*.srl

openssl verify -CAfile "$STAGE/ca.pem" "$STAGE/server.pem"
openssl verify -CAfile "$STAGE/ca.pem" "$STAGE/client.pem"

# Backup live + preserve previous CA for dual trust
if [[ -f "$DIR/server.pem" ]]; then
  mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
  cp -a "$DIR"/ca.pem "$DIR"/ca.key \
        "$DIR"/server.pem "$DIR"/server.key \
        "$DIR"/client.pem "$DIR"/client.key \
        "$DIR"/ca-previous.pem \
        "$BACKUP"/ 2>/dev/null || true
  # Overlap: current CA becomes previous (trusted alongside new CA)
  cp -a "$DIR/ca.pem" "$DIR/ca-previous.pem"
  chmod 644 "$DIR/ca-previous.pem"
  echo "dual-CA: ca-previous.pem set from prior ca.pem"
fi

for f in ca.pem ca.key server.pem server.key client.pem client.key; do
  cp -a "$STAGE/$f" "$DIR/$f"
done

printf '%s\n' "{\"rotatedAt\":\"$STAMP\",\"dualCa\":true,\"renewDays\":$RENEW_DAYS}" > "$DIR/last-rotation.json"
chmod 600 "$DIR/last-rotation.json"
touch "$DIR/RELOAD_REQUIRED"
chmod 600 "$DIR/RELOAD_REQUIRED"

if [[ "$KEEP_BACKUPS" -gt 0 ]]; then
  mapfile -t OLD < <(ls -1d "$DIR"/backup-* 2>/dev/null | sort -r | tail -n +$((KEEP_BACKUPS + 1)) || true)
  for b in "${OLD[@]:-}"; do
    [[ -n "$b" ]] || continue
    rm -rf "$b"
  done
fi

trap - EXIT
rm -rf "$STAGE"

cat <<EOF
rotation complete (dual-CA overlap active if prior CA existed)
1. Hot-reload platform TLS:
     kill -HUP <platform-pid>
     # or: curl -X POST -H "Authorization: Bearer \$TOKEN" http://127.0.0.1:4400/api/v1/security/tls/reload
2. Restart cloudflared so it uses new client.pem/client.key
3. After tunnel healthy, drop previous CA:
     bash scripts/finalize-mtls-overlap.sh
     kill -HUP <platform-pid>
EOF

if [[ -n "${CONTROL12_MTLS_POST_HOOK:-}" && -x "${CONTROL12_MTLS_POST_HOOK}" ]]; then
  "$CONTROL12_MTLS_POST_HOOK" "$DIR" "$STAMP"
fi
