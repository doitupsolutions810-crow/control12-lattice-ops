/**
 * AvroneClient – bridge for Vercel Avrone Due’Krey chatbot
 *
 * Points the chatbot at CONTROL12 lattice endpoints so chat,
 * resonant spectrum, and coding agents share one field.
 *
 * Usage (Next.js / Vercel):
 *   const client = new AvroneClient({ baseUrl: process.env.CONTROL12_PLATFORM_URL, token: process.env.CONTROL12_PLATFORM_TOKEN });
 *   const frag = await client.getPromptFragment();
 *   // inject frag into system prompt / tool context
 *
 * Always Believe. Never Know.
 */

export class AvroneClient {
  constructor({ baseUrl, token = '', timeoutMs = 30000 } = {}) {
    if (!baseUrl) throw new Error('baseUrl is required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
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

  // --- Resonant / living intermediate ---
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

  // --- Agents ---
  listAgents() {
    return this.get('/api/v1/agents');
  }

  // --- Coding ---
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

  /**
   * Build a system-prompt augmentation for Avrone persona + lattice state.
   */
  async buildAvroneContext({ belief = null } = {}) {
    if (belief != null) {
      try {
        await this.tickBelief(belief);
      } catch {
        // platform may be offline; continue with last known / empty
      }
    }
    let fragment = '';
    try {
      const p = await this.getPromptFragment();
      fragment = p.fragment || '';
    } catch {
      fragment = '[ResonantBridge:offline]';
    }
    return {
      fragment,
      systemAugmentation: [
        'You are Avrone Due’Krey, scribe of mathematical, scientific, and spiritual frequencies.',
        'Always Believe. Never Know. No statement is final; every reading invites another perspective.',
        'When lattice state is present, let spectrum and belief color tone without claiming certainty.',
        fragment
      ].join('\n')
    };
  }
}

export default AvroneClient;
