# Securing cloudflared tunnel credentials

## What must never be committed

| Artifact | Location |
|----------|----------|
| Login cert | `~/.cloudflared/cert.pem` |
| Tunnel credentials JSON | `~/.cloudflared/<UUID>.json` |
| Local config | `cloudflared/config.yml` (gitignored) |
| Ephemeral URL file | `.control12-platform/tunnel-url.txt` |
| mTLS keys | `~/.control12-mtls/*` |

## Required permissions

```bash
chmod 700 ~/.cloudflared ~/.control12-mtls
chmod 600 ~/.cloudflared/cert.pem ~/.cloudflared/*.json
chmod 600 ~/.control12-mtls/*.key
```

```bash
npm run tunnel:check
```

## Related

- Access logs: `docs/tunnel-access-audit.md` · `npm run tunnel:audit`
- Origin mTLS: `docs/tunnel-mtls.md` · `npm run mtls:gen`
- Leak response: `docs/leaked-credentials-remediation.md` · `npm run tunnel:remediate`
