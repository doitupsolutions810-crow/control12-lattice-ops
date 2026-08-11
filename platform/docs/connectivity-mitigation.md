# Vercel ↔ platform connectivity mitigation

## Problem

Platform defaults to `127.0.0.1`. Vercel serverless cannot reach localhost.

## Mitigations (layered)

| Layer | Mechanism |
|-------|-----------|
| 1 | **Local lattice shim** in `avrone-chat` — chat always has a system prompt |
| 2 | **CORS** on platform API + OPTIONS preflight |
| 3 | **`CONTROL12_CHAT_OPEN=1`** — session/turn without bearer (tunnel/dev only) |
| 4 | **cloudflared tunnel** (integrated scripts) |
| 5 | **Bearer token** on all mutating non-chat routes |

## Quick tunnel (ephemeral URL)

Terminal A — platform:

```bash
cd platform
export CONTROL12_CHAT_OPEN=1
export CONTROL12_PLATFORM_TOKEN="$(openssl rand -hex 32)"
npm run start:chat-open
```

Terminal B — tunnel:

```bash
cd platform
npm run tunnel
# or: bash scripts/tunnel.sh
```

When ready, the script prints and saves:

```text
.control12-platform/tunnel-url.txt
→ https://<random>.trycloudflare.com
```

Vercel env:

```text
CONTROL12_PLATFORM_URL=https://<random>.trycloudflare.com
XAI_API_KEY=...
# CONTROL12_PLATFORM_TOKEN only needed if CHAT_OPEN is off or for code/* from chat tools
```

Install cloudflared if missing:

```bash
brew install cloudflare/cloudflare/cloudflared   # macOS
# Linux: see Cloudflare Zero Trust install docs
```

## Named tunnel (stable hostname)

```bash
cloudflared tunnel login
cloudflared tunnel create control12-platform
cloudflared tunnel route dns control12-platform platform.example.com
cp cloudflared/config.example.yml cloudflared/config.yml
# edit tunnel UUID + credentials-file
npm run tunnel:named
```

## Docker Compose overlay

```bash
docker compose -f compose.yaml -f compose.tunnel.yaml up
docker compose -f compose.yaml -f compose.tunnel.yaml logs -f tunnel
```

Quick-tunnel URL appears in the `tunnel` service logs.

## Health checks

- Platform: `GET /health`
- Chat app: `GET /api/health` (reports platform reachability)
- After tunnel: `curl -fsS https://<tunnel-host>/health`
