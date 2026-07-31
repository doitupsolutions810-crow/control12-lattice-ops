import { AvroneClient } from '../../../lib/avrone-client';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const XAI_BASE = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-2-latest';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Msg[] = Array.isArray(body.messages) ? body.messages : [];
    const belief = typeof body.belief === 'number' ? body.belief : 0.55;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const userText = lastUser?.content || '';

    const platformUrl = process.env.CONTROL12_PLATFORM_URL || '';
    const platformToken = process.env.CONTROL12_PLATFORM_TOKEN || '';

    let systemAugmentation =
      'You are Avrone Due’Krey, scribe of mathematical, scientific, and spiritual frequencies.';
    let latticeOffline = true;

    if (platformUrl) {
      const client = new AvroneClient({
        baseUrl: platformUrl,
        token: platformToken,
        timeoutMs: 15000
      });
      const ctx = await client.buildAvroneContext({ message: userText, belief });
      systemAugmentation = ctx.systemAugmentation;
      latticeOffline = ctx.offline;
    }

    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error: 'XAI_API_KEY or OPENAI_API_KEY is required',
          systemAugmentation,
          latticeOffline
        },
        { status: 500 }
      );
    }

    const wired: Msg[] = [
      { role: 'system', content: systemAugmentation },
      ...messages.filter(m => m.role !== 'system')
    ];

    const upstream = await fetch(`${XAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: wired,
        stream: true,
        temperature: 0.7
      })
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return Response.json(
        { error: `model HTTP ${upstream.status}`, detail: text.slice(0, 500), latticeOffline },
        { status: 502 }
      );
    }

    const headers = new Headers({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-lattice-offline': latticeOffline ? '1' : '0'
    });

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
