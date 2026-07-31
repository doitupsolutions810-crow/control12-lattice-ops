# Access log parsing commands

Default log: `.control12-platform/access.jsonl`

## Helper

```bash
cd platform
npm run tunnel:parse                 # summary
npm run tunnel:parse -- .control12-platform/access.jsonl paths
npm run tunnel:parse -- .control12-platform/access.jsonl sensitive
npm run tunnel:parse -- .control12-platform/access.jsonl raw
```

Commands: `summary|status|paths|remotes|auth|sensitive|mtls|errors|tail|raw`

## Anomaly analysis

```bash
npm run tunnel:anomalies
# optional known allowlist (one IP per line):
# echo '203.0.113.10' >> .control12-platform/known-remotes.txt
```

Exit code **1** on high-severity findings (successful `code/*`/`terminal`, unauthenticated POST).

## Copy-paste jq one-liners

```bash
LOG=.control12-platform/access.jsonl

# Status histogram
jq -r '.status' "$LOG" | sort | uniq -c | sort -rn

# Top paths
jq -r '.path // empty' "$LOG" | sort | uniq -c | sort -rn | head -20

# Top remotes
jq -r '.remote // empty' "$LOG" | sort | uniq -c | sort -rn | head -20

# All 401s
jq -c 'select(.status==401)' "$LOG"

# Sensitive routes (any status)
jq -c 'select(.path!=null and (.path|test("/api/v1/(code|terminal|workflows)")))' "$LOG"

# Successful sensitive
jq -c 'select(.status!=null and .status<400 and (.path|test("/api/v1/(code|terminal)")))' "$LOG"

# Auth breakdown
jq -r '.auth // "?"' "$LOG" | sort | uniq -c

# POST without bearer
jq -c 'select(.method=="POST" and .auth=="none")' "$LOG"

# Non-mTLS traffic
jq -c 'select(.mtls!=true)' "$LOG" | head -50

# Time window (edit timestamp)
jq -c 'select(.observedAt >= "2026-07-31T18:00:00Z")' "$LOG"
```

Without jq, `parse-access-log.sh` falls back to `grep`/`sort`/`uniq`.
