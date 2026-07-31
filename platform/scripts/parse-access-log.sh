#!/usr/bin/env bash
# Concrete access-log parsing commands for operators.
# Usage:
#   bash scripts/parse-access-log.sh [access.jsonl] [command]
# Commands: summary|status|paths|remotes|auth|sensitive|mtls|errors|tail|raw
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${CONTROL12_PLATFORM_ROOT:-$ROOT/.control12-platform}"
LOG="${1:-${CONTROL12_ACCESS_LOG:-$STATE/access.jsonl}}"
CMD="${2:-summary}"

if [[ ! -f "$LOG" ]]; then
  echo "access log not found: $LOG" >&2
  exit 1
fi

has_jq=0
command -v jq >/dev/null 2>&1 && has_jq=1

echo "# log=$LOG cmd=$CMD"

case "$CMD" in
  summary)
    echo "lines=$(wc -l < "$LOG")"
    if [[ "$has_jq" -eq 1 ]]; then
      jq -r '[.status] | @tsv' "$LOG" 2>/dev/null | sort | uniq -c | sort -rn || true
    else
      grep -o '"status":[0-9]*' "$LOG" | sort | uniq -c | sort -rn
    fi
    ;;
  status)
    if [[ "$has_jq" -eq 1 ]]; then
      jq -r 'select(.status!=null) | "\(.status)\t\(.method)\t\(.path)\t\(.remote)//-"' "$LOG"
    else
      grep -E '"status":' "$LOG" | tail -50
    fi
    ;;
  paths)
    if [[ "$has_jq" -eq 1 ]]; then
      jq -r '.path // empty' "$LOG" | sort | uniq -c | sort -rn | head -30
    else
      grep -o '"path":"[^"]*"' "$LOG" | sort | uniq -c | sort -rn | head -30
    fi
    ;;
  remotes)
    if [[ "$has_jq" -eq 1 ]]; then
      jq -r '.remote // empty' "$LOG" | sort | uniq -c | sort -rn | head -30
    else
      grep -o '"remote":"[^"]*"' "$LOG" | sort | uniq -c | sort -rn | head -30
    fi
    ;;
  auth)
    if [[ "$has_jq" -eq 1 ]]; then
      jq -r '.auth // "?"' "$LOG" | sort | uniq -c | sort -rn
    else
      grep -o '"auth":"[^"]*"' "$LOG" | sort | uniq -c | sort -rn
    fi
    ;;
  sensitive)
    # code, terminal, quorum, workflows
    if [[ "$has_jq" -eq 1 ]]; then
      jq -c 'select(.path!=null and (.path|test("/api/v1/(code|terminal|workflows)")))' "$LOG"
    else
      grep -E '"path":"/api/v1/(code|terminal|workflows)' "$LOG" || true
    fi
    ;;
  mtls)
    if [[ "$has_jq" -eq 1 ]]; then
      echo "mtls true: $(jq -c 'select(.mtls==true)' "$LOG" | wc -l)"
      echo "mtls false/null: $(jq -c 'select(.mtls!=true)' "$LOG" | wc -l)"
    else
      echo "mtls true: $(grep -c '"mtls":true' "$LOG" || true)"
      echo "mtls false: $(grep -c '"mtls":false' "$LOG" || true)"
    fi
    ;;
  errors)
    if [[ "$has_jq" -eq 1 ]]; then
      jq -c 'select(.status!=null and .status>=400)' "$LOG" | tail -50
    else
      grep -E '"status":(4[0-9]{2}|5[0-9]{2})' "$LOG" | tail -50
    fi
    ;;
  tail)
    tail -20 "$LOG"
    ;;
  raw)
    # print copy-paste one-liners for the operator's shell
    cat <<EOF
# --- copy-paste log parsing ---
LOG="$LOG"

# Status histogram
jq -r '.status' "\$LOG" | sort | uniq -c | sort -rn

# Top paths
jq -r '.path // empty' "\$LOG" | sort | uniq -c | sort -rn | head -20

# Top remotes
jq -r '.remote // empty' "\$LOG" | sort | uniq -c | sort -rn | head -20

# 401 unauthorized
jq -c 'select(.status==401)' "\$LOG"

# Sensitive routes (code/terminal/workflows)
jq -c 'select(.path!=null and (.path|test("/api/v1/(code|terminal|workflows)")))' "\$LOG"

# Successful sensitive writes
jq -c 'select(.status!=null and .status<400 and (.path|test("/api/v1/(code|terminal)")))' "\$LOG"

# Auth mode breakdown
jq -r '.auth // "?"' "\$LOG" | sort | uniq -c

# Non-mTLS hits while expecting mTLS
jq -c 'select(.mtls!=true)' "\$LOG" | head -50

# Last hour-ish by string prefix (ISO date) — adjust date
# jq -c 'select(.observedAt >= "2026-07-31T18:00:00")' "\$LOG"
EOF
    ;;
  *)
    echo "unknown command: $CMD (summary|status|paths|remotes|auth|sensitive|mtls|errors|tail|raw)" >&2
    exit 2
    ;;
esac
