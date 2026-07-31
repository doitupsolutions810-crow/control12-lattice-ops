/**
 * ResonantBridge – Agent & Chatbot surface for LivingIntermediate
 *
 * Provides a stable, non-audio-dependent API that LLM chatbots and
 * CONTROL12 agents can call. Audio rendering is opportunistic:
 * when Web Audio is present it drives partials; otherwise state still
 * evolves for observability and prompt injection.
 *
 * Always Believe. Never Know.
 */

import { LivingIntermediate } from './living-intermediate.mjs';

export class ResonantBridge {
  constructor(options = {}) {
    this.voice = new LivingIntermediate(options);
    this.history = [];
    this.maxHistory = options.maxHistory ?? 48;
    this.label = options.label ?? 'avrone-resonant';
  }

  async ensureAudio() {
    try {
      await this.voice.initAudio();
    } catch {
      // Headless or restricted environment – state still valid
    }
    return this;
  }

  /**
   * Primary agent entry: advance belief and return structured status.
   */
  tick(belief, otherBelief = null) {
    const status = this.voice.tick(belief, otherBelief);
    const snapshot = {
      at: new Date().toISOString(),
      status,
      spectrum: this.voice.getSpectrum(),
      state: this.voice.getState()
    };
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) this.history.shift();
    return snapshot;
  }

  silence() {
    this.voice.silence();
    return { ok: true, silenced: true };
  }

  getState() {
    return this.voice.getState();
  }

  getSpectrum() {
    return this.voice.getSpectrum();
  }

  getHistory(limit = 8) {
    return this.history.slice(-limit);
  }

  /**
   * Compact context string suitable for LLM system / tool messages.
   */
  toPromptFragment() {
    const s = this.voice.getSpectrum();
    return [
      `[ResonantBridge:${this.label}]`,
      `belief=${s.belief.toFixed(3)}`,
      `tension=${s.tension.toFixed(3)}`,
      `carrier=${s.carrier}`,
      `partials=[${s.partials.slice(0, 8).join(', ')}]`,
      `amp=${s.amplitude.toFixed(3)}`
    ].join(' ');
  }
}

export default ResonantBridge;
