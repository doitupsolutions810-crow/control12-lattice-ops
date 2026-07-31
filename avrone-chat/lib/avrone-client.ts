/**
 * Browser/server-safe subset of platform AvroneClient for the chat app.
 */

export type AvroneContext = {
  systemAugmentation: string;
  session: { id: string; belief: number } | null;
  tools: Array<{ name: string; path: string }>;
  offline: boolean;
};

export class AvroneClient {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  sessionId: string | null = null;

  constructor({ baseUrl, token = '', timeoutMs = 20000 }: { baseUrl: string; token?: string; timeoutMs?: number }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  private headers() {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  private async post(path: string, body: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data as Record<string, unknown>;
  }

  private async get(path: string) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    return data as Record<string, unknown>;
  }

  async createSession(opts: { label?: string; belief?: number; nodeId?: string } = {}) {
    const session = await this.post('/api/v1/chat/session', {
      label: opts.label ?? 'avrone',
      belief: opts.belief ?? 0.55,
      nodeId: opts.nodeId ?? 'avrone'
    });
    this.sessionId = (session as { id: string }).id;
    return session as { id: string; belief: number };
  }

  async prepareTurn(sessionId: string, opts: { message?: string; belief?: number } = {}) {
    return this.post('/api/v1/chat/turn', {
      sessionId,
      message: opts.message ?? '',
      belief: opts.belief
    });
  }

  async buildAvroneContext(opts: { message?: string; belief?: number } = {}): Promise<AvroneContext> {
    const basePersona =
      'You are Avrone Due’Krey, scribe of mathematical, scientific, and spiritual frequencies.\n' +
      'When lattice state is present, let spectrum and belief color tone without claiming certainty.';

    try {
      if (!this.sessionId) {
        await this.createSession({ belief: opts.belief ?? 0.55 });
      }
      const turn = await this.prepareTurn(this.sessionId!, {
        message: opts.message,
        belief: opts.belief
      });
      const systemAugmentation =
        (turn.systemAugmentation as string) ||
        `${basePersona}\n${(turn as { systemAugmentation?: string }).systemAugmentation || ''}`;
      return {
        systemAugmentation,
        session: (turn.session as { id: string; belief: number }) || null,
        tools: (turn.tools as Array<{ name: string; path: string }>) || [],
        offline: false
      };
    } catch {
      let fragment = '[ResonantBridge:offline]';
      try {
        const p = await this.get('/api/v1/audio/prompt');
        fragment = (p.fragment as string) || fragment;
      } catch {
        /* fully offline */
      }
      return {
        systemAugmentation: `${basePersona}\n${fragment}`,
        session: null,
        tools: [],
        offline: true
      };
    }
  }

  codingQuorum(body: {
    goal: string;
    path?: string;
    content?: string;
    command?: string;
    skipRemoteAgents?: boolean;
  }) {
    return this.post('/api/v1/code/quorum', {
      skipRemoteAgents: true,
      ...body
    });
  }
}
