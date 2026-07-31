# Runtime next steps (post 3f7c1db lineage)

## Belief field seed

On platform boot, nodes are created and linked:

- `operator`, `avrone`, `planner`, `engineer`, `verifier`, `coder`
- Edges: avrone↔operator (1.5), planner→engineer→coder→verifier→operator ring

Inspect: `GET /api/v1/belief/snapshot`

## Avrone / Vercel chat

1. Set `CONTROL12_PLATFORM_URL` and `CONTROL12_PLATFORM_TOKEN` on Vercel.
2. Copy `platform/src/bridge/avrone-client.mjs` into the Next app (or depend on the platform package).
3. Use `platform/examples/vercel-avrone-chat-route.ts` as a template for `app/api/chat/route.ts`.
4. Each user message: `buildAvroneContext({ message })` → inject `systemAugmentation`.

## Quorum-first code

Preferred path:

```http
POST /api/v1/code/quorum
POST /api/v1/workflows/from-template
{ "template": "coding-quorum-local", "goal": "...", "path": "x.js", "content": "...", "run": true }
```

Force bare write/produce through quorum:

```bash
export CONTROL12_CODE_REQUIRE_QUORUM=1
```

## Optional production profile

```bash
export CONTROL12_CODE_STRICT_ALLOWLIST=1
export CONTROL12_CODE_REQUIRE_QUORUM=1
export CONTROL12_CODE_MAX_CONCURRENT=1
export CONTROL12_CODE_RATE_LIMIT=10
export CONTROL12_PLATFORM_TOKEN="$(openssl rand -hex 32)"
```

Allowlist stays **unrestricted** unless `STRICT_ALLOWLIST=1` is set.
