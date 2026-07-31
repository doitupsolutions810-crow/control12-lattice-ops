#!/usr/bin/env bash
# Ensure multi-session belief mesh nodes exist via API (path 6).
# Requires platform up. Uses CHAT_OPEN or bearer.
set -euo pipefail
HOST="${CONTROL12_PLATFORM_HOST:-127.0.0.1}"
PORT="${CONTROL12_PLATFORM_PORT:-4400}"
TOKEN="${CONTROL12_PLATFORM_TOKEN:-}"
BASE="http://${HOST}:${PORT}"
AUTH=()
[[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")

post() {
  local path="$1" body="$2"
  curl -fsS -X POST "${AUTH[@]}" -H "content-type: application/json" -d "$body" "$BASE$path"
}

# Nodes (idempotent upsert)
for pair in "operator:0.5" "avrone:0.55" "planner:0.5" "engineer:0.5" "verifier:0.5" "coder:0.5"; do
  id="${pair%%:*}"
  b="${pair##*:}"
  post /api/v1/belief/node "{\"id\":\"$id\",\"belief\":$b,\"label\":\"$id\"}" >/dev/null
  echo "node $id"
done

post /api/v1/belief/link '{"a":"avrone","b":"operator","weight":1.5}' >/dev/null || true
post /api/v1/belief/link '{"a":"avrone","b":"planner","weight":1}' >/dev/null || true
post /api/v1/belief/link '{"a":"planner","b":"engineer","weight":1}' >/dev/null || true
post /api/v1/belief/link '{"a":"engineer","b":"coder","weight":1}' >/dev/null || true
post /api/v1/belief/link '{"a":"coder","b":"verifier","weight":1}' >/dev/null || true
post /api/v1/belief/link '{"a":"verifier","b":"operator","weight":1}' >/dev/null || true

post /api/v1/belief/tick '{}' >/dev/null || true
curl -fsS "$BASE/api/v1/belief/snapshot"
echo
echo "mesh seeded"
