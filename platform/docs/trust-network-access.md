# Trust network access patterns & mitigations

## Actors

| Actor | Trust basis |
|-------|-------------|
| **Platform origin** | Process on host; holds workspace + lattice state |
| **cloudflared** | Tunnel credentials JSON + optional origin mTLS client cert |
| **Vercel Avrone chat** | Outbound HTTPS to `CONTROL12_PLATFORM_URL`; bearer optional if `CHAT_OPEN` |
| **Operator laptop** | Bearer token; local curl/dashboard |
| **Internet stranger** | Only if public hostname/URL is known |

## Access patterns

```text
[Internet] --HTTPS--> [Cloudflare edge] --tunnel--> [cloudflared] --mTLS?--> [platform :4400]
                              ^
[Vercel serverless] ----------+  (CONTROL12_PLATFORM_URL)

[Operator] --HTTP(S) localhost--> [platform]
[Operator] --Bearer--> code/terminal/quorum
```

### Pattern A — Local only

- Platform binds `127.0.0.1`
- No tunnel

**Mitigations:** default bind; no `CHAT_OPEN` required; firewall not critical.

### Pattern B — Quick tunnel (`trycloudflare.com`)

- Ephemeral public URL
- Often `CHAT_OPEN=1` for session/turn

**Mitigations:**

1. Treat URL as secret while live; do not commit `tunnel-url.txt`
2. Never enable `CHAT_OPEN` with `code/*` reachable without bearer (bearer still required for code)
3. Short lifetime; kill tunnel when done
4. `npm run tunnel:anomalies` after session
5. Rotate `CONTROL12_PLATFORM_TOKEN` if URL leaked

### Pattern C — Named tunnel + hostname

- Stable DNS; credentials JSON on disk

**Mitigations:**

1. Credentials only under `~/.cloudflared` mode 600; `npm run tunnel:check`
2. **Disable `CHAT_OPEN`**; require bearer on session/turn
3. Origin **mTLS** so only cloudflared client cert reaches platform
4. Cloudflare Access policy at edge (email/device) as extra layer
5. Access logs + weekly `security:pass`

### Pattern D — Vercel → tunnel → platform

- Server-side fetch from Vercel (no browser CORS need)

**Mitigations:**

1. Platform URL + token in Vercel encrypted env only
2. Token required when `CHAT_OPEN=0`
3. Local lattice shim if platform down (no secrets in shim)
4. Health: `GET /api/health` on chat app

### Pattern E — Compromised tunnel credentials

**Mitigations (ordered):** `npm run tunnel:remediate` — stop tunnel, delete tunnel, rotate JSON/token/mTLS, audit access log, rebuild.

### Pattern F — Cert rotation without downtime window collapse

**Mitigations:** dual-CA overlap (below) + hot reload + finalize after cloudflared cutover.

---

## Dual-CA hot reload (implemented)

### Mechanism

1. **Rotate** copies live `ca.pem` → `ca-previous.pem`, installs new CA/server/client.
2. Platform trust store = **[new CA, previous CA]** (`tls-material.mjs`).
3. **Hot reload** without process exit:
   - `SIGHUP` → `server.setSecureContext(...)`
   - or `POST /api/v1/security/tls/reload` (bearer auth)
4. Restart **cloudflared** only (new client cert).
5. **Finalize:** `finalize-mtls-overlap.sh` removes `ca-previous.pem`; reload again.

During overlap, clients presenting certs signed by either CA succeed. After finalize, only the new CA is trusted.

### Operator sequence

```bash
npm run mtls:rotate -- --force
# reload platform trust store (dual CA)
kill -HUP $(pgrep -f 'node src/server.mjs')
# or:
curl -fsS -X POST -H "Authorization: Bearer $CONTROL12_PLATFORM_TOKEN" \
  http://127.0.0.1:4400/api/v1/security/tls/reload

# cut over tunnel client cert
pkill -f 'cloudflared tunnel' || true
npm run tunnel:named   # or system restart unit

# after healthy:
bash scripts/finalize-mtls-overlap.sh
kill -HUP $(pgrep -f 'node src/server.mjs')
npm run mtls:verify
rm -f ~/.control12-mtls/RELOAD_REQUIRED
```

### Limits

- Hot reload updates the **TLS stack** only; it does not restart workers or clear memory.
- cloudflared must still be restarted (or otherwise reload client cert files).
- Lab certs remain self-signed; edge validation may use `noTLSVerify` on the origin leg.
