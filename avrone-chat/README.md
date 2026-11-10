# Avrone Due’Krey · CONTROL12 Verified Lattice Console

Next.js dashboard combining a verified v72 package snapshot, bounded Avrone chat,
and a browser-local coding workspace. Snapshot values are explicitly package-derived
and are never presented as live telemetry.

Without a model-provider key, chat uses a deterministic, server-owned snapshot
responder. With a provider key, it uses the configured model endpoint. In both modes,
client system-role messages and chatbot production mutations remain denied.

The workspace persists in the current browser using local storage and emits a
SHA-256 hash-linked revision each time a file is saved. It does not execute code,
upload files, read secrets, or confer production authority.

## Env

```bash
XAI_API_KEY=...

CONTROL12_PLATFORM_URL=https://<tunnel-or-public-host>
CONTROL12_PLATFORM_TOKEN=<read-only chat integration token>
```

## Connect platform via cloudflared

On the machine running the platform:

```bash
cd platform
npm start

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

Put the application behind an authenticated gateway or Vercel deployment protection before enabling a paid model key. The chatbot does not expose cockpit mutations; operator actions must use the separately authenticated CONTROL12 policy/admission surface.
