# Ops: weekly security pass

```bash
cd platform
npm run security:pass

# Also evaluate mTLS age / rotate if due:
CONTROL12_SECURITY_ROTATE=1 npm run security:pass
```

## What it runs

1. `tunnel:check` — credential path/mode (skips cleanly if no named config)
2. `tunnel:anomalies` — high-severity exit if code/terminal successes or unauth POSTs
3. Optional `mtls:rotate` age check when `CONTROL12_SECURITY_ROTATE=1`
4. `tunnel:parse` summary

## Cron

```cron
15 5 * * 1  cd /path/to/platform && CONTROL12_SECURITY_ROTATE=1 bash scripts/security-pass.sh >>/var/log/c12-security-pass.log 2>&1
```

## Known remotes

```bash
cp .control12-platform/known-remotes.example.txt .control12-platform/known-remotes.txt
# add trusted egress IPs (Vercel is dynamic — prefer anomaly review over brittle allowlists)
```

## Related

| Command | Doc |
|---------|-----|
| `npm run tunnel:anomalies` | access-log-commands.md |
| `npm run mtls:rotate` | cert-rotation.md |
| `npm run tunnel:remediate` | leaked-credentials-remediation.md |
