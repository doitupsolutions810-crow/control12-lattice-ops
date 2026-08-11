import { AvroneClient } from '../../../lib/avrone-client';
import { localLatticeAugmentation } from '../../../lib/local-lattice';
import { deterministicSnapshotReply } from '../../../lib/snapshot-v72';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const XAI_BASE = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-2-latest';
const MAX_BODY_BYTES = Number(process.env.AVRONE_CHAT_MAX_BODY_BYTES || 64_000);
const MAX_MESSAGES = Number(process.env.AVRONE_CHAT_MAX_MESSAGES || 50);
const MAX_MESSAGE_CHARS = Number(process.env.AVRONE_CHAT_MAX_MESSAGE_CHARS || 8_000);
const UPSTREAM_TIMEOUT_MS = Number(process.env.AVRONE_CHAT_UPSTREAM_TIMEOUT_MS || 55_000);

function assertAllowedOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  const requestUrl = new URL(req.url);
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const host = forwardedHost || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(':', '');
  const requestOrigins = new Set([requestUrl.origin]);
  if (host && /^(https?|http)$/.test(protocol)) requestOrigins.add(`${protocol}://${host}`);
  const configured = new Set(
    (process.env.AVRONE_ALLOWED_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
  if (!requestOrigins.has(origin) && !configured.has(origin)) throw new Error('request origin denied');
}

async function readBoundedJson(req: Request) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error('request body too large');
  if (!req.body) return {};
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel('request body too large');
      throw new Error('request body too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);
  return raw ? JSON.parse(raw) : {};
}

function validateMessages(value: unknown): Msg[] {
  if (!Array.isArray(value) || value.length > MAX_MESSAGES) throw new Error('invalid messages');
  let total = 0;
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('invalid message');
    const candidate = item as Partial<Msg>;
    if (candidate.role !== 'user' && candidate.role !== 'assistant') throw new Error('invalid message role');
    if (typeof candidate.content !== 'string' || candidate.content.length > MAX_MESSAGE_CHARS) throw new Error('invalid message content');
    total += candidate.content.length;
    if (total > MAX_BODY_BYTES) throw new Error('message content too large');
    return { role: candidate.role, content: candidate.content };
  });
}

function validatedUpstreamBase() {
  const url = new URL(XAI_BASE);
  const loopback = url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('model endpoint must use HTTPS or loopback HTTP');
  if (url.username || url.password) throw new Error('model endpoint credentials are not allowed in the URL');
  return url.toString().replace(/\/$/, '');
}

function deterministicStream(content: string, latticeOffline: boolean, latticeSource: string) {
  const payload = JSON.stringify({ choices: [{ delta: { content } }] });
  return new Response(`data: ${payload}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store',
      'x-lattice-offline': latticeOffline ? '1' : '0',
      'x-lattice-source': latticeSource,
      'x-avrone-mode': 'deterministic-snapshot'
    }
  });
}

export async function POST(req: Request) {
  try {
    assertAllowedOrigin(req);
    const body = (await readBoundedJson(req)) as { messages?: unknown; belief?: unknown };
    const messages = validateMessages(body.messages);
    const belief = typeof body.belief === 'number' && Number.isFinite(body.belief)
      ? Math.max(0, Math.min(1, body.belief))
      : 0.55;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const userText = lastUser?.content || '';

    const platformUrl = process.env.CONTROL12_PLATFORM_URL || '';
    const platformToken = process.env.CONTROL12_PLATFORM_TOKEN || '';

    let systemAugmentation = localLatticeAugmentation(belief, userText);
    let latticeOffline = true;
    let latticeSource: 'platform' | 'local-shim' = 'local-shim';

    if (platformUrl) {
      const client = new AvroneClient({
        baseUrl: platformUrl,
        token: platformToken,
        timeoutMs: 10000
      });
      const ctx = await client.buildAvroneContext({ message: userText, belief });
      systemAugmentation = ctx.systemAugmentation;
      latticeOffline = ctx.offline;
      latticeSource = ctx.source;
    }

    const apiKey = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return deterministicStream(deterministicSnapshotReply(userText), latticeOffline, latticeSource);
    }

    const wired: Msg[] = [
      { role: 'system', content: systemAugmentation },
      ...messages.filter(m => m.role !== 'system')
    ];

    const upstream = await fetch(`${validatedUpstreamBase()}/chat/completions`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: wired,
        stream: true,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });

    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      return Response.json(
        {
          error: `model HTTP ${upstream.status}`,
          latticeOffline,
          latticeSource
        },
        { status: 502 }
      );
    }

    const headers = new Headers({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-lattice-offline': latticeOffline ? '1' : '0',
      'x-lattice-source': latticeSource,
      'x-avrone-mode': 'provider'
    });

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientError = /request|invalid message|origin denied|message content|endpoint/.test(message);
    return Response.json(
      { error: message },
      { status: clientError ? 400 : 500, headers: { 'cache-control': 'no-store' } }
    );
  }
}
