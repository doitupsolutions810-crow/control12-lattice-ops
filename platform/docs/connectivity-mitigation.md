# Vercel ↔ platform connectivity mitigation

## Problem

Platform defaults to `127.0.0.1`. Vercel serverless cannot reach localhost.

## Mitigations (layered)

| Layer | Mechanism |
|-------|-----------|
| 1 | **Local lattice shim** in `avrone-chat` — chat always has a system prompt |
| 2 | **CORS** on platform API + OPTIONS preflight |
| 3 | **`CONTROL12_CHAT_OPEN=1`** — session/turn without bearer (tunnel/dev only) |
| 4 | **Tunnel** (`cloudflared` / ngrok) → public HTTPS → `CONTROL12_PLATFORM_URL` |
| 5 | **Bearer token** on all mutating non-chat routes |

## Recommended tunnel setup

```bash
export CONTROL12_CHAT_OPEN=1
export CONTROL12_PLATFORM_TOKEN="$(openssl rand -hex 32)"  # still protects code/*
npm start --prefix platform

cloudflared tunnel --url http://127.0.0.1:4400
```

Vercel env:

```
CONTROL12_PLATFORM_URL=https://<tunnel-host>
# token optional while CHAT_OPEN=1 for session/turn only
XAI_API_KEY=...
```

## Health checks

- Platform: `GET /health`
- Chat app: `GET /api/health` (reports platform reachability)
