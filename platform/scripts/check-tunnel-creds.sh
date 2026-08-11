#!/usr/bin/env bash
# Validate cloudflared credential files are present and not world-readable.
# Usage:
#   bash scripts/check-tunnel-creds.sh [path-to-config.yml]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="${1:-${CONTROL12_CF_CONFIG:-$ROOT/cloudflared/config.yml}}"
FAIL=0

warn() { echo "[warn] $*" >&2; }
err()  { echo "[fail] $*" >&2; FAIL=1; }
ok()   { echo "[ok]   $*"; }

if [[ ! -f "$CONFIG" ]]; then
  err "config not found: $CONFIG"
  exit 1
fi

ok "config: $CONFIG"

# Reject configs living in a tracked path that still contains secrets patterns
if [[ "$CONFIG" == "$ROOT/cloudflared/"* ]]; then
  warn "config is under the repo tree — ensure it stays gitignored"
fi

# Extract credentials-file path (simple YAML line parse)
CRED_LINE="$(grep -E '^[[:space:]]*credentials-file:[[:space:]]*' "$CONFIG" || true)"
if [[ -z "$CRED_LINE" ]]; then
  err "no credentials-file entry in config"
  exit 1
fi

CRED="$(echo "$CRED_LINE" | sed -E 's/^[[:space:]]*credentials-file:[[:space:]]*//' | tr -d '"' | tr -d "'")"
# Expand leading ~
if [[ "$CRED" == ~* ]]; then
  CRED="${CRED/#\~/$HOME}"
fi

if [[ ! -f "$CRED" ]]; then
  err "credentials file missing: $CRED"
  exit 1
fi

ok "credentials-file: $CRED"

# Prefer credentials outside the repository
case "$CRED" in
  "$ROOT"/*)
    err "credentials file is inside the repository ($CRED) — move to ~/.cloudflared/"
    ;;
  *)
    ok "credentials path is outside the repo"
    ;;
esac

# Permission checks (Unix)
if command -v stat >/dev/null 2>&1; then
  MODE="$(stat -c '%a' "$CRED" 2>/dev/null || stat -f '%OLp' "$CRED" 2>/dev/null || echo '')"
  if [[ -n "$MODE" ]]; then
    # Accept 600 or 400 only
    if [[ "$MODE" != "600" && "$MODE" != "400" ]]; then
      err "credentials mode is $MODE (want 600 or 400). Run: chmod 600 '$CRED'"
    else
      ok "credentials mode $MODE"
    fi
  fi

  # Directory should not be world-writable
  CDIR="$(dirname "$CRED")"
  DMODE="$(stat -c '%a' "$CDIR" 2>/dev/null || stat -f '%OLp' "$CDIR" 2>/dev/null || echo '')"
  if [[ -n "$DMODE" && "${DMODE: -1}" == "7" ]]; then
    warn "credentials directory is world-writable ($DMODE): $CDIR"
  fi
fi

# cert.pem if present near default cloudflared dir
CERT="${CLOUDFLARED_CERT:-$HOME/.cloudflared/cert.pem}"
if [[ -f "$CERT" ]]; then
  CMODE="$(stat -c '%a' "$CERT" 2>/dev/null || stat -f '%OLp' "$CERT" 2>/dev/null || echo '')"
  if [[ -n "$CMODE" && "$CMODE" != "600" && "$CMODE" != "400" ]]; then
    err "cert.pem mode is $CMODE (want 600 or 400). Run: chmod 600 '$CERT'"
  else
    ok "cert.pem permissions"
  fi
  case "$CERT" in
    "$ROOT"/*) err "cert.pem inside repo — move to ~/.cloudflared/cert.pem" ;;
  esac
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "credential checks failed" >&2
  exit 1
fi

echo "credential checks passed"
