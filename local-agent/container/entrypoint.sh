#!/usr/bin/env bash
set -Eeuo pipefail

APP_PORT="${CONTROL12_PORT:-4312}"
PUBLIC_PORT="${CONTROL12_PUBLIC_PORT:-8080}"
MODEL_HOST="${CONTROL12_MODEL_HOST:-model}"
MODEL_PORT="${CONTROL12_MODEL_PORT:-8080}"
APP_DIR="${CONTROL12_ROOT:-$HOME/.control12}/app"

pids=()

cleanup() {
  local pid
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

socat \
  "TCP-LISTEN:11435,bind=127.0.0.1,reuseaddr,fork" \
  "TCP:${MODEL_HOST}:${MODEL_PORT}" &
pids+=("$!")

CONTROL12_MODEL_URL="http://127.0.0.1:11435" \
CONTROL12_PORT="$APP_PORT" \
node "$APP_DIR/server.mjs" &
pids+=("$!")

for _ in $(seq 1 180); do
  if curl --fail --silent "http://127.0.0.1:${APP_PORT}/health" >/dev/null; then
    break
  fi
  sleep 1
done

socat \
  "TCP-LISTEN:${PUBLIC_PORT},bind=0.0.0.0,reuseaddr,fork" \
  "TCP:127.0.0.1:${APP_PORT}" &
pids+=("$!")

wait -n "${pids[@]}"
