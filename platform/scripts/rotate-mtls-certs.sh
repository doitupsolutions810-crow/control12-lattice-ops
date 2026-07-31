#!/usr/bin/env bash
# Rotate origin mTLS material under ~/.control12-mtls (or CONTROL12_MTLS_DIR).
#
# Renew decision (prefer openssl -checkend):
#   rotate when server.pem expires within CONTROL12_MTLS_RENEW_DAYS (default 60)
#   or when --force, or when server.pem is missing
#
# Atomic: mint into stage-$STAMP, verify, then swap into place.
# On failure: leave live certs untouched; stage removed.
#
# Usage:
#   bash scripts/rotate-mtls-certs.sh
#   bash scripts/rotate-mtls-certs.sh --force
#   CONTROL12_MTLS_RENEW_DAYS=30 bash scripts/rotate-mtls-certs.sh
#   CONTROL12_MTLS_POST_HOOK=/path/to/reload.sh bash scripts/rotate-mtls-certs.sh --force
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
      cat <<EOF
Usage: $0 [--force]
  Renew window: CONTROL12_MTLS_RENEW_DAYS (default 60)
  Validity:     CONTROL12_MTLS_DAYS (default 825)
  Post hook:    CONTROL12_MTLS_POST_HOOK (optional executable)
EOF
      exit 0
      ;;
  esac
done

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 1
fi

need_rotate() {
  if [[ "$FORCE" -eq 1 ]]; then
    echo "decision: force"
    return 0
  fi
  if [[ ! -f "$DIR/server.pem" ]]; then
    echo "decision: missing server.pem"
    return 0
  fi
  # Exit code 1 => will expire within RENEW_DAYS (or already expired)
  local secs=$((RENEW_DAYS * 86400))
  if openssl x509 -in "$DIR/server.pem" -checkend "$secs" -noout 2>/dev/null; then
    local end
    end="$(openssl x509 -enddate -noout -in "$DIR/server.pem" 2>/dev/null | cut -d= -f2 || true)"
    echo "decision: not due (notAfter=${end:-unknown}, renew_days=$RENEW_DAYS)"
    return 1
  fi
  echo "decision: within renew window ($RENEW_DAYS days) or expired"
  return 0
}

if ! need_rotate; then
  exit 0
fi

mkdir -p "$DIR"
chmod 700 "$DIR"

STAGE="$DIR/stage-$STAMP"
BACKUP="$DIR/backup-$STAMP"
rm -rf "$STAGE"
mkdir -p "$STAGE"
chmod 700 "$STAGE"

cleanup_stage() {
  rm -rf "$STAGE"
}
trap cleanup_stage EXIT

echo "minting new material in $STAGE"

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

echo "verifying chain"
openssl verify -CAfile "$STAGE/ca.pem" "$STAGE/server.pem"
openssl verify -CAfile "$STAGE/ca.pem" "$STAGE/client.pem"

# Backup live material if present
if [[ -f "$DIR/server.pem" ]]; then
  mkdir -p "$BACKUP"
  chmod 700 "$BACKUP"
  cp -a "$DIR"/ca.pem "$DIR"/ca.key \
        "$DIR"/server.pem "$DIR"/server.key \
        "$DIR"/client.pem "$DIR"/client.key \
        "$BACKUP"/ 2>/dev/null || true
  echo "backed up live material to $BACKUP"
fi

# Swap: copy stage files into DIR (paths stay stable for env + cloudflared)
for f in ca.pem ca.key server.pem server.key client.pem client.key; do
  cp -a "$STAGE/$f" "$DIR/$f"
done

printf '%s\n' "{\"rotatedAt\":\"$STAMP\",\"dir\":\"$DIR\",\"force\":$FORCE,\"renewDays\":$RENEW_DAYS,\"daysValid\":$DAYS_VALID}" \
  > "$DIR/last-rotation.json"
chmod 600 "$DIR/last-rotation.json"

# Platform loads certs at process start — flag that restart is required
touch "$DIR/RELOAD_REQUIRED"
chmod 600 "$DIR/RELOAD_REQUIRED"

# Prune old backups
if [[ "$KEEP_BACKUPS" -gt 0 ]]; then
  mapfile -t OLD < <(ls -1d "$DIR"/backup-* 2>/dev/null | sort -r | tail -n +$((KEEP_BACKUPS + 1)) || true)
  for b in "${OLD[@]:-}"; do
    [[ -n "$b" ]] || continue
    rm -rf "$b"
    echo "pruned $b"
  done
fi

trap - EXIT
rm -rf "$STAGE"

echo "rotation complete: $DIR"
echo "RELOAD_REQUIRED set — restart platform (TLS_* paths unchanged if using defaults)"
echo "Restart cloudflared so it presents the new client.pem/client.key"
echo "Verify: bash scripts/verify-mtls-certs.sh"

if [[ -n "${CONTROL12_MTLS_POST_HOOK:-}" && -x "${CONTROL12_MTLS_POST_HOOK}" ]]; then
  echo "running post hook: $CONTROL12_MTLS_POST_HOOK"
  "$CONTROL12_MTLS_POST_HOOK" "$DIR" "$STAMP"
fi
