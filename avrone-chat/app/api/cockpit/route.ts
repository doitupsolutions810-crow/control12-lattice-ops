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
    const securityData = security.ok ? await security.json() as Record<string, unknown> : {};
    const beliefData = belief.ok ? await belief.json() as Record<string, unknown> : {};
    const nodes = Array.isArray(beliefData.nodes) ? beliefData.nodes : [];
    out.security = security.ok
      ? {
          severity: typeof securityData.severity === 'string' ? securityData.severity : 'unknown',
          mtls: Boolean(securityData.mtls),
          dualCa: Boolean(securityData.dualCa)
        }
      : { ok: false, status: security.status };
    out.belief = belief.ok
      ? {
          meanBelief: typeof beliefData.meanBelief === 'number' ? beliefData.meanBelief : null,
          nodes: nodes.slice(0, 100).map(node => {
            const item = node && typeof node === 'object' ? node as Record<string, unknown> : {};
            return {
              id: typeof item.id === 'string' ? item.id.slice(0, 128) : 'unknown',
              belief: typeof item.belief === 'number' ? item.belief : 0
            };
          })
        }
      : { ok: false, status: belief.status };
    out.platform = { ok: health.ok };
  } catch (e) {
    out.platform = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return Response.json(out);
}
