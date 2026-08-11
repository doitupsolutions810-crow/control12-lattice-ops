#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${CONTROL12_PLATFORM_PORT:-4499}"
STATE="$(mktemp -d)"
cleanup(){ kill "${PID:-}" 2>/dev/null || true; rm -rf "$STATE"; }
trap cleanup EXIT
CONTROL12_PLATFORM_ROOT="$STATE" CONTROL12_PLATFORM_PORT="$PORT" CONTROL12_LOCAL_AGENT_URL="http://127.0.0.1:9" \
  node "$ROOT/src/server.mjs" >"$STATE/server.log" 2>&1 &
PID=$!
for _ in {1..30}; do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null && break; sleep .2; done
curl -fsS "http://127.0.0.1:$PORT/health" | grep -q '"version": "1.0.0"'
curl -fsS "http://127.0.0.1:$PORT/api/v1/components" | grep -q 'agent.verifier'
curl -fsS "http://127.0.0.1:$PORT/api/v1/security/status" | grep -q '"severity"'
curl -fsS "http://127.0.0.1:$PORT/api/v1/belief/snapshot" | grep -q 'avrone'
echo "PASS: CONTROL12 platform smoke test"
