# mTLS certificate rotation automation

## Investigation summary (addressed)

| Issue | Fix |
|-------|-----|
| Inconsistent age vs remaining-days thresholds | Single rule: `openssl x509 -checkend` renew window |
| Non-atomic replace (crash mid-write) | Stage dir → verify → swap; live untouched on failure |
| No chain verify after mint | `openssl verify` on server + client |
| Duplicate gen vs rotate logic | `mtls:gen` calls `rotate --force` when empty |
| No reload signal | `RELOAD_REQUIRED` flag + optional `CONTROL12_MTLS_POST_HOOK` |
| Backup growth | Keep last `CONTROL12_MTLS_KEEP_BACKUPS` (default 5) |

**Still inherent:** Node loads TLS material at process start. Rotation always requires **platform restart** and **cloudflared restart** (new CA → new client cert). There is a brief coordinated outage window; dual-CA overlap is not implemented.

## Commands

```bash
npm run mtls:rotate                 # if within renew window (default 60d)
npm run mtls:rotate -- --force      # always
npm run mtls:verify                 # chain + modes + renew status
npm run mtls:gen                    # first-time (or no-op if present)
```

Env:

| Variable | Default | Meaning |
|----------|---------|--------|
| `CONTROL12_MTLS_DIR` | `~/.control12-mtls` | Material root |
| `CONTROL12_MTLS_RENEW_DAYS` | 60 | Rotate when expiry within N days |
| `CONTROL12_MTLS_DAYS` | 825 | Cert validity |
| `CONTROL12_MTLS_KEEP_BACKUPS` | 5 | Backup dirs to retain |
| `CONTROL12_MTLS_POST_HOOK` | — | Executable after successful swap |

## After rotation

```bash
# paths unchanged if using defaults
export CONTROL12_MTLS=1
export CONTROL12_TLS_CERT=$HOME/.control12-mtls/server.pem
export CONTROL12_TLS_KEY=$HOME/.control12-mtls/server.key
export CONTROL12_TLS_CA=$HOME/.control12-mtls/ca.pem
# restart platform, then cloudflared
rm -f $HOME/.control12-mtls/RELOAD_REQUIRED   # after both restarted
npm run mtls:verify
```

## Cron

```cron
0 4 * * 1  cd /path/to/platform && bash scripts/rotate-mtls-certs.sh && bash scripts/verify-mtls-certs.sh >>/var/log/c12-mtls-rotate.log 2>&1
```
