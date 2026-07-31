#!/usr/bin/env bash
# Rotate origin mTLS material under ~/.control12-mtls (or CONTROL12_MTLS_DIR).
# Keeps timestamped backup; regenerates CA + server + client certs.
#
# Usage:
#   bash scripts/rotate-mtls-certs.sh           # rotate if age >= MAX_AGE_DAYS (default 60)
#   bash scripts/rotate-mtls-certs.sh --force   # always rotate
#   CONTROL12_MTLS_MAX_AGE_DAYS=30 bash scripts/rotate-mtls-certs.sh
set -euo pipefail

DIR="${CONTROL12_MTLS_DIR:-$HOME/.control12-mtls}"
MAX_AGE_DAYS="${CONTROL12_MTLS_MAX_AGE_DAYS:-60}"
DAYS_VALID="${CONTROL12_MTLS_DAYS:-825}"
CN_SERVER="${CONTROL12_MTLS_SERVER_CN:-control12-platform.local}"
CN_CLIENT="${CONTROL12_MTLS_CLIENT_CN:-cloudflared-origin}"
FORCE=0
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --help|-h)
      echo "Usage: $0 [--force]"
      exit 0
      ;;
  esac
done

need_rotate() {
  if [[ "$FORCE" -eq 1 ]]; then return 0; fi
  if [[ ! -f "$DIR/server.pem" ]]; then return 0; fi
  # Prefer openssl enddate; fall back to file mtime age
  if command -v openssl >/dev/null 2>&1; then
    local end
    end="$(openssl x509 -enddate -noout -in "$DIR/server.pem" 2>/dev/null | cut -d= -f2 || true)"
    if [[ -n "$end" ]]; then
      local end_epoch now_epoch remain
      end_epoch="$(date -d "$end" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$end" +%s 2>/dev/null || echo 0)"
      now_epoch="$(date +%s)"
      if [[ "$end_epoch" -gt 0 ]]; then
        remain=$(( (end_epoch - now_epoch) / 86400 ))
        echo "server.pem days until expiry: $remain"
        # Rotate when fewer than MAX_AGE_DAYS remain OR cert already expired
        if [[ "$remain" -lt "$MAX_AGE_DAYS" ]]; then return 0; fi
        return 1
      fi
    fi
  fi
  # mtime fallback
  local age_days
  age_days="$(( ( $(date +%s) - $(stat -c %Y "$DIR/server.pem" 2>/dev/null || stat -f %m "$DIR/server.pem") ) / 86400 ))"
  echo "server.pem file age days: $age_days"
  [[ "$age_days" -ge "$MAX_AGE_DAYS" ]]
}

if ! need_rotate; then
  echo "rotation not required (max age threshold $MAX_AGE_DAYS days)"
  exit 0
fi

mkdir -p "$DIR"
chmod 700 "$DIR"

if [[ -f "$DIR/server.pem" ]]; then
  BACKUP="$DIR/backup-$STAMP"
  mkdir -p "$BACKUP"
  cp -a "$DIR"/*.pem "$DIR"/*.key "$BACKUP"/ 2>/dev/null || true
  chmod 700 "$BACKUP"
  echo "backed up previous material to $BACKUP"
fi

cd "$DIR"
rm -f ca.pem ca.key server.pem server.key client.pem client.key ca.srl server.csr client.csr

openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_VALID" -out ca.pem \
  -subj "/CN=control12-dev-ca-$STAMP"

openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=${CN_SERVER}"
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -out server.pem -days "$DAYS_VALID" -sha256

openssl genrsa -out client.key 2048
openssl req -new -key client.key -out client.csr -subj "/CN=${CN_CLIENT}"
openssl x509 -req -in client.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -out client.pem -days "$DAYS_VALID" -sha256

chmod 600 ca.key server.key client.key
chmod 644 ca.pem server.pem client.pem
rm -f server.csr client.csr ca.srl

# Record rotation event
printf '%s\n' "{\"rotatedAt\":\"$STAMP\",\"dir\":\"$DIR\",\"force\":$FORCE}" > "$DIR/last-rotation.json"
chmod 600 "$DIR/last-rotation.json"

echo "rotation complete: $DIR"
echo "Restart platform with CONTROL12_MTLS=1 and updated TLS_* paths."
echo "Update cloudflared tlsClientCert/Key to $DIR/client.pem and client.key, then restart tunnel."
echo "Verify: openssl x509 -in $DIR/server.pem -noout -dates"
