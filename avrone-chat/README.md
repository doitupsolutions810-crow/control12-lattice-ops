# Avrone Chat

Next.js chatbot wired to CONTROL12 lattice (`/api/v1/chat/session` + `/turn`).
Falls back to a **local lattice shim** when the platform is unreachable.

## Env

```bash
XAI_API_KEY=...

# Platform (optional — chat works offline with local shim)
CONTROL12_PLATFORM_URL=https://<public-or-tunnel-host>
CONTROL12_PLATFORM_TOKEN=<token>   # omit if platform CONTROL12_CHAT_OPEN=1
```

## Mitigated connectivity path

Platform binds to localhost by default. For Vercel:

```bash
# On the machine running the platform:
export CONTROL12_CHAT_OPEN=1          # session/turn without bearer (dev/tunnel)
export CONTROL12_PLATFORM_BIND=0.0.0.0  # optional LAN bind
node platform/src/server.mjs

# Expose with cloudflared (example):
cloudflared tunnel --url http://127.0.0.1:4400
# → set CONTROL12_PLATFORM_URL on Vercel to the https://*.trycloudflare.com URL
```

Code/terminal routes still require bearer when `CONTROL12_PLATFORM_TOKEN` is set.

## Local

```bash
cd avrone-chat && npm install && npm run dev
curl -s localhost:3000/api/health | jq
```

## Deploy on Vercel

1. Import repo; **Root Directory** = `avrone-chat`
2. Set `XAI_API_KEY` (+ optional platform URL/token)
3. Deploy
