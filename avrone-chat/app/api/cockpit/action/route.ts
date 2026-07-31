export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy cockpit actions to platform (bearer). */
export async function POST(req: Request) {
  const platformUrl = (process.env.CONTROL12_PLATFORM_URL || '').replace(/\/$/, '');
  const token = process.env.CONTROL12_PLATFORM_TOKEN || '';
  if (!platformUrl) {
    return Response.json({ error: 'CONTROL12_PLATFORM_URL not set' }, { status: 503 });
  }
  const body = await req.json();
  const res = await fetch(`${platformUrl}/api/v1/cockpit/action`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  });
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.status });
}
