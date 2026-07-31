export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const platformUrl = process.env.CONTROL12_PLATFORM_URL || '';
  let platform: { ok: boolean; status?: number; error?: string } = { ok: false };

  if (platformUrl) {
    try {
      const res = await fetch(`${platformUrl.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      platform = { ok: res.ok, status: res.status };
    } catch (e) {
      platform = {
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  }

  return Response.json({
    status: 'ok',
    service: 'avrone-chat',
    platformConfigured: Boolean(platformUrl),
    platform,
    modelKeyPresent: Boolean(process.env.XAI_API_KEY || process.env.OPENAI_API_KEY)
  });
}
