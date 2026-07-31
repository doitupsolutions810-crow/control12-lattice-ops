# Tunnel access audit logs

## Location

Default: `$CONTROL12_PLATFORM_ROOT/access.jsonl` (usually `platform/.control12-platform/access.jsonl`)

Override: `CONTROL12_ACCESS_LOG=/path/to/access.jsonl`

## Fields

| Field | Meaning |
|-------|---------|
| method, path, status, durationMs | Request basics |
| remote | `cf-connecting-ip`, else `x-forwarded-for`, else socket |
| auth | `bearer` \| `chat-open` \| `none` |
| mtls | Whether a peer client cert was present |
| clientCert | subject, fingerprint, authorized |
| userAgent, host | Headers |

## Audit

```bash
cd platform
npm run tunnel:audit
# or: bash scripts/audit-access-logs.sh
```

Watch for: unexpected remotes, `code/*` or `terminal` paths, 401 spikes, requests with `auth: none` on sensitive routes.
