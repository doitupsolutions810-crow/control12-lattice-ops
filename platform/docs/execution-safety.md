# Code execution safety bounds

Policy for CodingAgent + terminal. These reduce accidental harm;
they are **not** a guarantee against a determined adversary.

## Layers

| Layer | Default | Override env |
|-------|---------|--------------|
| Workspace path confinement | relative only, no `..` | `CONTROL12_CODE_WORKSPACE` |
| Max write size | 512 KiB | `CONTROL12_CODE_MAX_WRITE_BYTES` |
| Denied write extensions | `.sh`, `.exe`, `.pem`, … | via `policyOptions` |
| Max command length | 2000 chars | `CONTROL12_CODE_MAX_COMMAND_CHARS` |
| Blocked command patterns | rm -rf /, curl\|sh, sudo, reverse shells, … | via `policyOptions` |
| Strict allowlist | off | `CONTROL12_CODE_STRICT_ALLOWLIST=1` |
| Max concurrent exec | 2 | `CONTROL12_CODE_MAX_CONCURRENT` |
| Rate limit | 20 / 60s | `CONTROL12_CODE_RATE_LIMIT` |
| Max timeout | 120s | `CONTROL12_CODE_MAX_TIMEOUT_MS` |
| Terminal host | local-agent localhost | `CONTROL12_LOCAL_AGENT_URL` |

## Inspection

```
GET /api/v1/code/policy
```

Returns live snapshot (workspace, limits, in-flight count).

## What still sits outside this policy

- local-agent itself must stay bound to `127.0.0.1`
- OS-level sandbox (containers, seccomp) is complementary, not replaced
- Symlink attacks that resolve *inside* the workspace after open are not fully closed here
- Network egress from allowed tools (e.g. `npm install`) depends on host firewall
