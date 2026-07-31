/**
 * AvroneClient – bridge for Vercel Avrone Due’Krey chatbot
 *
 * Usage (Next.js / Vercel):
 *   const client = new AvroneClient({
 *     baseUrl: process.env.CONTROL12_PLATFORM_URL,
 *     token: process.env.CONTROL12_PLATFORM_TOKEN
 *   });
 *   const session = await client.createSession({ label: 'avrone', belief: 0.55, nodeId: 'avrone' });
 *   const turn = await client.prepareTurn(session.id, { message: userText });
 *   // use turn.systemAugmentation in the model system prompt
 */

export class AvroneClient {
  constructor({ baseUrl, token = '', timeoutMs = 30000 } = {}) {
    if (!baseUrl) throw new Error('baseUrl is required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.sessionId = null;
  }

  headers(extra = {}) {
    const h = { 'content-type': 'application/json', ...extra };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }

  async get(path) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async post(path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // --- Chat wire ---
  async createSession({ label = 'avrone', belief = 0.55, nodeId = 'avrone' } = {}) {
    const session = await this.post('/api/v1/chat/session', { label, belief, nodeId });
    this.sessionId = session.id;
    return session;
  }

  async prepareTurn(sessionId, { message = '', belief = null } = {}) {
    const id = sessionId || this.sessionId;
    if (!id) throw new Error('sessionId required; call createSession first');
    return this.post('/api/v1/chat/turn', { sessionId: id, message, belief });
  }

  listTools() {
    return this.get('/api/v1/chat/tools');
  }

  // --- Resonant / belief ---
  getSpectrum() {
    return this.get('/api/v1/audio/spectrum');
  }

  getState() {
    return this.get('/api/v1/audio/state');
  }

  getPromptFragment() {
    return this.get('/api/v1/audio/prompt');
  }

  tickBelief(belief, otherBelief = null) {
    return this.post('/api/v1/audio/tick', { belief, otherBelief });
  }

  silence() {
    return this.post('/api/v1/audio/silence', {});
  }

  beliefSnapshot() {
    return this.get('/api/v1/belief/snapshot');
  }

  beliefTick() {
    return this.post('/api/v1/belief/tick', {});
  }

  listAgents() {
    return this.get('/api/v1/agents');
  }

  // --- Code (prefer quorum for non-trivial writes) ---
  writeCode(path, content) {
    return this.post('/api/v1/code/write', { path, content });
  }

  editCode(path, oldString, newString, replaceAll = false) {
    return this.post('/api/v1/code/edit', { path, oldString, newString, replaceAll });
  }

  readCode(path) {
    return this.post('/api/v1/code/read', { path });
  }

  listCode(path = '.') {
    return this.post('/api/v1/code/list', { path });
  }

  runTerminal(command, cwd = null) {
    return this.post('/api/v1/terminal', { command, cwd });
  }

  produceAndRun({ path, content, command }) {
    return this.post('/api/v1/code/produce', { path, content, command });
  }

  codingQuorum({ goal, path = null, content = null, command = null, skipRemoteAgents = true }) {
    return this.post('/api/v1/code/quorum', {
      goal,
      path,
      content,
      command,
      skipRemoteAgents
    });
  }

  /**
   * Ensure session, prepare turn, return systemAugmentation for the model.
   */
  async buildAvroneContext({ belief = null, message = '', sessionId = null } = {}) {
    try {
      if (!sessionId && !this.sessionId) {
        await this.createSession({
          label: 'avrone',
          belief: belief != null ? belief : 0.55,
          nodeId: 'avrone'
        });
      }
      const turn = await this.prepareTurn(sessionId || this.sessionId, { message, belief });
      return {
        session: turn.session,
        fragment: turn.systemAugmentation,
        systemAugmentation: turn.systemAugmentation,
        tools: turn.tools,
        snapshot: turn.snapshot
      };
    } catch {
      let fragment = '[ResonantBridge:offline]';
      try {
        const p = await this.getPromptFragment();
        fragment = p.fragment || fragment;
      } catch {
        /* offline */
      }
      return {
        session: null,
        fragment,
        systemAugmentation: [
          'You are Avrone Due’Krey, scribe of mathematical, scientific, and spiritual frequencies.',
          'When lattice state is present, let spectrum and belief color tone without claiming certainty.',
          fragment
        ].join('\n'),
        tools: [],
        snapshot: null
      };
    }
  }
}

export default AvroneClient;
