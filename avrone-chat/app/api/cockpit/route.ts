export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cockpit aggregate for Avrone UI (path 2):
 * platform security status + belief snapshot + local health.
 */
export async function GET() {
  const platformUrl = (process.env.CONTROL12_PLATFORM_URL || '').replace(/\/$/, '');
  const token = process.env.CONTROL12_PLATFORM_TOKEN || '';
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const out: Record<string, unknown> = {
    service: 'avrone-chat',
    observedAt: new Date().toISOString(),
    platformConfigured: Boolean(platformUrl)
  };

  if (!platformUrl) {
    out.platform = { ok: false, error: 'CONTROL12_PLATFORM_URL not set' };
    return Response.json(out);
  }

  try {
    const [health, security, belief] = await Promise.all([
      fetch(`${platformUrl}/health`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`${platformUrl}/api/v1/security/status`, { headers, signal: AbortSignal.timeout(8000) }),
      fetch(`${platformUrl}/api/v1/belief/snapshot`, { headers, signal: AbortSignal.timeout(8000) })
    ]);
    out.health = health.ok ? await health.json() : { ok: false, status: health.status };
    out.security = security.ok ? await security.json() : { ok: false, status: security.status };
    out.belief = belief.ok ? await belief.json() : { ok: false, status: belief.status };
    out.platform = { ok: health.ok };
  } catch (e) {
    out.platform = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return Response.json(out);
}
