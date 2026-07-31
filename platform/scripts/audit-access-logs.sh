#!/usr/bin/env bash
# Summarize platform access logs (tunnel traffic).
# Usage:
#   bash scripts/audit-access-logs.sh [access.jsonl]
#   CONTROL12_ACCESS_LOG=/path/to/access.jsonl bash scripts/audit-access-logs.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${CONTROL12_PLATFORM_ROOT:-$ROOT/.control12-platform}"
LOG="${1:-${CONTROL12_ACCESS_LOG:-$STATE/access.jsonl}}"

if [[ ! -f "$LOG" ]]; then
  echo "access log not found: $LOG" >&2
  exit 1
fi

echo "=== access log: $LOG ==="
echo "lines: $(wc -l < "$LOG")"
echo

echo "--- status counts ---"
grep -o '"status":[0-9]*' "$LOG" | sort | uniq -c | sort -rn || true
echo

echo "--- top paths ---"
grep -o '"path":"[^"]*"' "$LOG" | sort | uniq -c | sort -rn | head -20 || true
echo

echo "--- auth failures (401) sample ---"
grep '"status":401' "$LOG" | tail -10 || echo "(none)"
echo

echo "--- mTLS present ---"
grep -c '"mtls":true' "$LOG" 2>/dev/null || echo 0
echo

echo "--- unique remotes (sample) ---"
grep -o '"remote":"[^"]*"' "$LOG" | sort -u | head -30 || true
echo

echo "--- last 5 entries ---"
tail -5 "$LOG"
