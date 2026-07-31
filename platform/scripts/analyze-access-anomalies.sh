#!/usr/bin/env bash
# Analyze access.jsonl for anomalies relevant to tunnel exposure.
# Exit code 1 if any high-severity finding is present.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="${CONTROL12_PLATFORM_ROOT:-$ROOT/.control12-platform}"
LOG="${1:-${CONTROL12_ACCESS_LOG:-$STATE/access.jsonl}}"
KNOWN_REMOTES_FILE="${CONTROL12_KNOWN_REMOTES:-$STATE/known-remotes.txt}"
MIN_401_SPIKE="${CONTROL12_ANOMALY_401_MIN:-20}"
FINDINGS=0
HIGH=0

if [[ ! -f "$LOG" ]]; then
  echo "access log not found: $LOG" >&2
  exit 1
fi

has_jq=0
command -v jq >/dev/null 2>&1 && has_jq=1

echo "=== anomaly analysis: $LOG ==="
echo

# --- 401 spike ---
if [[ "$has_jq" -eq 1 ]]; then
  C401="$(jq -c 'select(.status==401)' "$LOG" | wc -l | tr -d ' ')"
else
  C401="$(grep -c '"status":401' "$LOG" || true)"
fi
echo "[check] 401 count=$C401 (threshold=$MIN_401_SPIKE)"
if [[ "$C401" -ge "$MIN_401_SPIKE" ]]; then
  echo "  FINDING: elevated 401s — possible credential stuffing or probe"
  FINDINGS=$((FINDINGS+1))
fi
echo

# --- sensitive path successes ---
if [[ "$has_jq" -eq 1 ]]; then
  SENS="$(jq -c 'select(.status!=null and .status<400 and (.path!=null) and (.path|test("/api/v1/(code|terminal)")))' "$LOG" | wc -l | tr -d ' ')"
  SENS_SAMPLE="$(jq -c 'select(.status!=null and .status<400 and (.path!=null) and (.path|test("/api/v1/(code|terminal)")))' "$LOG" | tail -5)"
else
  SENS="$(grep -E '"path":"/api/v1/(code|terminal)' "$LOG" | grep -E '"status":2[0-9][0-9]' | wc -l | tr -d ' ' || true)"
  SENS_SAMPLE="$(grep -E '"path":"/api/v1/(code|terminal)' "$LOG" | tail -5 || true)"
fi
echo "[check] successful code/terminal responses=$SENS"
if [[ "$SENS" -gt 0 ]]; then
  echo "  FINDING: sensitive routes returned success — review remotes and auth"
  echo "$SENS_SAMPLE" | sed 's/^/    /'
  FINDINGS=$((FINDINGS+1))
  HIGH=$((HIGH+1))
fi
echo

# --- auth none on POST ---
if [[ "$has_jq" -eq 1 ]]; then
  NONE_POST="$(jq -c 'select(.method=="POST" and .auth=="none")' "$LOG" | wc -l | tr -d ' ')"
else
  NONE_POST="$(grep '"method":"POST"' "$LOG" | grep '"auth":"none"' | wc -l | tr -d ' ' || true)"
fi
echo "[check] POST with auth=none count=$NONE_POST"
if [[ "$NONE_POST" -gt 0 ]]; then
  echo "  FINDING: unauthenticated POSTs observed"
  FINDINGS=$((FINDINGS+1))
  HIGH=$((HIGH+1))
fi
echo

# --- chat-open on sensitive ---
if [[ "$has_jq" -eq 1 ]]; then
  OPEN_SENS="$(jq -c 'select(.auth=="chat-open" and (.path!=null) and (.path|test("/api/v1/(code|terminal)")))' "$LOG" | wc -l | tr -d ' ')"
else
  OPEN_SENS=0
fi
echo "[check] chat-open on code/terminal=$OPEN_SENS"
if [[ "$OPEN_SENS" -gt 0 ]]; then
  echo "  FINDING: chat-open should never authorize code/terminal"
  FINDINGS=$((FINDINGS+1))
  HIGH=$((HIGH+1))
fi
echo

# --- new remotes vs known list ---
if [[ -f "$KNOWN_REMOTES_FILE" ]]; then
  echo "[check] comparing remotes to $KNOWN_REMOTES_FILE"
  if [[ "$has_jq" -eq 1 ]]; then
    jq -r '.remote // empty' "$LOG" | sort -u > /tmp/c12-remotes-$$.txt
  else
    grep -o '"remote":"[^"]*"' "$LOG" | sed 's/"remote":"//;s/"$//' | sort -u > /tmp/c12-remotes-$$.txt
  fi
  NEW="$(comm -13 <(sort -u "$KNOWN_REMOTES_FILE") /tmp/c12-remotes-$$.txt || true)"
  rm -f /tmp/c12-remotes-$$.txt
  if [[ -n "$NEW" ]]; then
    echo "  FINDING: new remotes not in known list:"
    echo "$NEW" | sed 's/^/    /'
    FINDINGS=$((FINDINGS+1))
  else
    echo "  no new remotes"
  fi
else
  echo "[check] no known-remotes file at $KNOWN_REMOTES_FILE (create one line per trusted IP)"
  if [[ "$has_jq" -eq 1 ]]; then
    echo "  current remotes:"
    jq -r '.remote // empty' "$LOG" | sort | uniq -c | sort -rn | head -15 | sed 's/^/    /'
  fi
fi
echo

# --- non-mTLS when many requests (informational if MTLS expected) ---
if [[ "$has_jq" -eq 1 ]]; then
  TOTAL="$(wc -l < "$LOG" | tr -d ' ')"
  MTLS_N="$(jq -c 'select(.mtls==true)' "$LOG" | wc -l | tr -d ' ')"
else
  TOTAL="$(wc -l < "$LOG" | tr -d ' ')"
  MTLS_N="$(grep -c '"mtls":true' "$LOG" || true)"
fi
echo "[check] mtls ratio=$MTLS_N/$TOTAL"
if [[ "$TOTAL" -gt 10 && "$MTLS_N" -eq 0 && "${CONTROL12_MTLS:-}" == "1" ]]; then
  echo "  FINDING: CONTROL12_MTLS=1 but no mtls=true in logs"
  FINDINGS=$((FINDINGS+1))
fi
echo

echo "=== summary: findings=$FINDINGS high=$HIGH ==="
if [[ "$HIGH" -gt 0 ]]; then
  echo "High-severity anomalies present. Consider: npm run tunnel:remediate"
  exit 1
fi
if [[ "$FINDINGS" -gt 0 ]]; then
  echo "Anomalies present; review samples above."
  exit 0
fi
echo "No anomalies flagged by current heuristics."
exit 0
