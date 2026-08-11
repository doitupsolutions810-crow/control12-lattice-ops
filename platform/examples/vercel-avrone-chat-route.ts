/**
 * Drop-in Next.js App Router example for Avrone chat wired to CONTROL12.
 *
 * Place as: app/api/chat/route.ts (adjust imports for your project).
 * Env:
 *   CONTROL12_PLATFORM_URL
 *   CONTROL12_PLATFORM_TOKEN
 *   XAI_API_KEY (or your model provider)
 *
 * Copy AvroneClient into the Next app or publish from the platform package.
 */

import { AvroneClient } from '../../../src/bridge/avrone-client.mjs';

// Pseudo-types for illustration — replace with your AI SDK imports.
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const platformUrl = process.env.CONTROL12_PLATFORM_URL || '';
const platformToken = process.env.CONTROL12_PLATFORM_TOKEN || '';

export async function POST(req: Request) {
  const body = await req.json();
  const messages: ChatMessage[] = body.messages || [];
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUser?.content || '';

  let systemAugmentation =
    'You are Avrone Due’Krey, scribe of mathematical, scientific, and spiritual frequencies.';

  if (platformUrl) {
    try {
      const client = new AvroneClient({
        baseUrl: platformUrl,
        token: platformToken,
        timeoutMs: 20000
      });
      const ctx = await client.buildAvroneContext({
        message: userText,
        belief: typeof body.belief === 'number' ? body.belief : 0.55
      });
      systemAugmentation = ctx.systemAugmentation;
    } catch {
      // platform offline — continue with base persona
    }
  }

  const wiredMessages: ChatMessage[] = [
    { role: 'system', content: systemAugmentation },
    ...messages.filter(m => m.role !== 'system')
  ];

  // Replace this block with your streaming model call (xAI / OpenAI-compatible).
  return Response.json({
    ok: true,
    note: 'Replace with model stream; system prompt is lattice-wired.',
    systemAugmentation,
    messageCount: wiredMessages.length
  });
}
