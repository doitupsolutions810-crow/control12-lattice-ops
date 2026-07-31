# Securing cloudflared tunnel credentials

## What must never be committed

| Artifact | Location |
|----------|----------|
| Login cert | `~/.cloudflared/cert.pem` |
| Tunnel credentials JSON | `~/.cloudflared/<UUID>.json` |
| Local config | `cloudflared/config.yml` (gitignored) |
| Ephemeral URL file | `.control12-platform/tunnel-url.txt` |

Root and `cloudflared/.gitignore` exclude these patterns.

## Required permissions

```bash
chmod 700 ~/.cloudflared
chmod 600 ~/.cloudflared/cert.pem
chmod 600 ~/.cloudflared/*.json
```

Validate:

```bash
cd platform
npm run tunnel:check
# or: bash scripts/check-tunnel-creds.sh /path/to/config.yml
```

`tunnel:named` refuses to start if `credentials-file` points inside the repository.

## Preferred layout

```text
~/.cloudflared/
  cert.pem                 # mode 600
  <TUNNEL_UUID>.json       # mode 600
  config.yml               # optional; mode 600

platform/cloudflared/
  config.example.yml       # committed template only
  config.yml               # local, gitignored — or do not keep secrets here at all
```

```bash
export CONTROL12_CF_CONFIG=$HOME/.cloudflared/config.yml
npm run tunnel:named
```

## Token + open chat policy

| Mode | Use |
|------|-----|
| `CONTROL12_CHAT_OPEN=1` | Local / ephemeral trycloudflare only |
| Bearer `CONTROL12_PLATFORM_TOKEN` | Always for `code/*`, `terminal`, workflows |
| Named public hostname | **Disable** `CHAT_OPEN`; require bearer on session/turn |

If a credentials JSON or `cert.pem` is leaked: revoke the tunnel in Cloudflare Zero Trust, `tunnel delete`, create a new tunnel, rotate `CONTROL12_PLATFORM_TOKEN`.

## Quick tunnel note

`npm run tunnel` does not use a credentials JSON file; the trycloudflare URL is short-lived. Still treat the URL as sensitive while it is active (anyone with the URL can hit open chat routes if `CHAT_OPEN=1`).
