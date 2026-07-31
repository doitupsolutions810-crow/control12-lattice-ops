# Avrone ↔ CONTROL12 Lattice Bridge

Integration notes for wiring the Vercel Avrone Due’Krey chatbot
to the sovereign platform audio + coding surfaces.

## Endpoints the chatbot can use

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/audio/prompt` | no | LLM prompt fragment |
| GET | `/api/v1/audio/spectrum` | no | belief, tension, partials |
| GET | `/api/v1/audio/state` | no | full state + jacobian row |
| POST | `/api/v1/audio/tick` | yes | advance belief |
| POST | `/api/v1/code/write` | yes | write file in workspace |
| POST | `/api/v1/code/edit` | yes | edit file |
| POST | `/api/v1/code/produce` | yes | write + optional terminal run |
| POST | `/api/v1/terminal` | yes | bounded execute via local-agent |

## Vercel env

```
CONTROL12_PLATFORM_URL=https://<your-platform-host>
CONTROL12_PLATFORM_TOKEN=<shared secret matching CONTROL12_PLATFORM_TOKEN on platform>
```

## Client usage

```js
import { AvroneClient } from '@control12/platform/bridge/avrone-client.mjs';
// or copy platform/src/bridge/avrone-client.mjs into the Next app

const client = new AvroneClient({
  baseUrl: process.env.CONTROL12_PLATFORM_URL,
  token: process.env.CONTROL12_PLATFORM_TOKEN
});

const { systemAugmentation } = await client.buildAvroneContext({ belief: 0.55 });
// prepend systemAugmentation to Avrone system prompt
```

## Coding agents

Terminal execution is always delegated to **local-agent**
(`POST /api/tools/terminal` on `127.0.0.1:4312`), which enforces:

- localhost-only bind
- command timeout
- bounded output size

Platform coding routes refuse paths that escape `CONTROL12_CODE_WORKSPACE`.

## Jacobian of belief

State advances via `integrateBeliefStep` in `platform/src/audio/jacobian.mjs`.
Spectrum and prompt fragments include a compact jacobian row for agent/LLM context.
