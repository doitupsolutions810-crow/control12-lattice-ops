#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${CONTROL12_FABRIC_PORT:-14500}"
TMP="$(mktemp -d)"
SECRET="$(printf 's%.0s' {1..32})"
BOOT="$(printf 'b%.0s' {1..32})"
cleanup(){
  if [[ -n "${PID:-}" ]]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT
CONTROL12_FABRIC_ROOT="$TMP" CONTROL12_FABRIC_PORT="$PORT" CONTROL12_FABRIC_SECRET="$SECRET" CONTROL12_BOOTSTRAP_SECRET="$BOOT" node "$ROOT/src/server.mjs" & PID=$!
for _ in {1..50}; do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep .1; done
curl -fsS "http://127.0.0.1:$PORT/ready" | grep -q 'ready'
TOKEN="$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/v2/auth/token" -H "x-control12-bootstrap: $BOOT" -H 'content-type: application/json' -d '{"tenant":"default","subject":"smoke","scopes":["fabric.admin"]}' | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).token')"
curl -fsS "http://127.0.0.1:$PORT/api/v2/system" -H "authorization: Bearer $TOKEN" | grep -q '2.0.0'
echo "PASS: CONTROL12 Sovereign Fabric smoke test"
