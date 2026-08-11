# Chat wiring · Belief graph · Coding quorum

## Allowlist default

**Unrestricted** by default: command allowlist is off.
Blocked patterns, path confinement, size, rate, and concurrency limits still apply.

Enable strict allowlist only with:

```bash
export CONTROL12_CODE_STRICT_ALLOWLIST=1
```

`GET /api/v1/code/policy` reports `allowlistMode: "unrestricted" | "strict"`.

## Chat wiring (Avrone / Vercel)

```text
POST /api/v1/chat/session   { label, belief, nodeId? }
POST /api/v1/chat/turn      { sessionId, message?, belief? }
GET  /api/v1/chat/tools
```

Turn response includes `systemAugmentation` (resonant + belief graph fragments) and tool descriptors.

## Multi-belief graph

```text
POST /api/v1/belief/node   { id, belief, label? }
POST /api/v1/belief/link   { a, b, weight? }
POST /api/v1/belief/set    { id, belief }
POST /api/v1/belief/tick
GET  /api/v1/belief/snapshot
```

`tick` advances ResonantBridge per node using weighted mean neighbor belief as `otherBelief`.

## Coding quorum

```text
POST /api/v1/code/quorum
{
  "goal": "...",
  "path": "src/x.js",          // optional
  "content": "...",            // optional with path
  "command": "node --test",    // optional
  "skipRemoteAgents": true     // local verifier only
}
```

Loop: planner → engineer → coder (write/execute) → verifier (evidence-keyed).

Workflow step types: `code`, `coding-quorum`.
