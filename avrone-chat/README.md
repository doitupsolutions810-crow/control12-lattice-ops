# Avrone Chat

Next.js chatbot wired to CONTROL12 lattice (`/api/v1/chat/session` + `/turn`).

## Env

```bash
XAI_API_KEY=...
# optional overrides:
# XAI_BASE_URL=https://api.x.ai/v1
# XAI_MODEL=grok-2-latest

CONTROL12_PLATFORM_URL=https://<platform-host>
CONTROL12_PLATFORM_TOKEN=<same as platform CONTROL12_PLATFORM_TOKEN>
```

If the platform is unreachable, chat still works with a base Avrone system prompt (`x-lattice-offline: 1`).

## Local

```bash
cd avrone-chat
npm install
npm run dev
```

## Deploy on Vercel

1. Import `control12-lattice-ops` (or this subdirectory as root).
2. Set **Root Directory** to `avrone-chat`.
3. Add env vars above.
4. Deploy.

```bash
# from repo root, if using Vercel CLI:
vercel --cwd avrone-chat
```

Platform must expose the chat routes and accept the bearer token on POSTs.
