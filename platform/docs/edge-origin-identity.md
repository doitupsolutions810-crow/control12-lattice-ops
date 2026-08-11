# Edge + origin identity (path 5)

Three independent gates for production hostnames:

| Layer | Mechanism | Failure mode if lost |
|-------|-----------|----------------------|
| **Edge** | Cloudflare Access (email, IdP, device posture, optional edge mTLS) | Origin still requires tunnel + mTLS |
| **Origin** | cloudflared client cert (CONTROL12_MTLS) | Random TCP to :4400 rejected at handshake |
| **API** | Bearer `CONTROL12_PLATFORM_TOKEN` | Chat/code mutating routes 401 |

Never rely on a single layer. Production profile sets `CONTROL12_CHAT_OPEN=0` so session/turn also need bearer.

## Cloudflare Access (dashboard)

1. Create Application → Self-hosted → hostname `platform.example.com`
2. Policy: allow corporate emails / IdP groups
3. Optional: require service token for Vercel (machine-to-machine)
4. Vercel stores Access service token headers if required by policy

## Origin mTLS

See `tunnel-mtls.md` + dual-CA cutover `scripts/mtls-cutover.sh`.

## API bearer

Rotate with remediation runbook; never ship lab `CHAT_OPEN=1` on Access-protected hostnames without understanding that Access ≠ platform auth.
