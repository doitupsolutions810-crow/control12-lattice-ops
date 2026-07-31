# Remediation: leaked tunnel credentials

Run the assisted checklist:

```bash
cd platform
npm run tunnel:remediate
```

## Ordered steps

1. **Stop exposure** — kill `cloudflared`; stop platform if `CHAT_OPEN` without token.
2. **Revoke tunnel** — `cloudflared tunnel delete <uuid>`; remove Access apps for the hostname.
3. **Rotate local files** — delete compromised `~/.cloudflared/<uuid>.json`; optionally re-`tunnel login`.
4. **Rotate `CONTROL12_PLATFORM_TOKEN`** — new 32-byte hex; update Vercel; disable `CHAT_OPEN` on public hosts.
5. **Rotate mTLS** — `rm -rf ~/.control12-mtls && npm run mtls:gen`; update cloudflared client cert paths.
6. **Audit** — `npm run tunnel:audit`; inspect unexpected remotes and `code/*` hits.
7. **Rebuild** — new tunnel, DNS route, `tunnel:check`, `tunnel:named`.
8. **Verify** — `/health` over the new hostname; confirm bearer required.

## Indicators of abuse in access.jsonl

- Unknown `remote` values at high volume
- Successful `POST /api/v1/code/*` or `/api/v1/terminal` from unexpected IPs
- Long-lived sessions after a known leak window

Treat any confirmed `code/*` success during a leak window as a full workspace incident: quarantine workspace, review git history, rotate all tokens.
