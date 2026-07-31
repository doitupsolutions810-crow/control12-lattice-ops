# Avrone Chat

Next.js chatbot wired to CONTROL12 lattice (`/api/v1/chat/session` + `/turn`).
Falls back to a **local lattice shim** when the platform is unreachable.

## Env

```bash
XAI_API_KEY=...

CONTROL12_PLATFORM_URL=https://<tunnel-or-public-host>
CONTROL12_PLATFORM_TOKEN=<token>   # omit if platform CONTROL12_CHAT_OPEN=1
```

## Connect platform via cloudflared

On the machine running the platform:

```bash
cd platform
export CONTROL12_CHAT_OPEN=1
npm run start:chat-open

# other terminal
npm run tunnel
# copy https://*.trycloudflare.com into Vercel CONTROL12_PLATFORM_URL
```

See `platform/docs/connectivity-mitigation.md`.

## Local

```bash
cd avrone-chat && npm install && npm run dev
curl -s localhost:3000/api/health
```

## Deploy on Vercel

1. Import repo; **Root Directory** = `avrone-chat`
2. Set `XAI_API_KEY` and `CONTROL12_PLATFORM_URL` (tunnel URL)
3. Deploy
