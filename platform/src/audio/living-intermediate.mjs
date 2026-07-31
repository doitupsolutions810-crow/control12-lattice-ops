/**
 * LivingIntermediate – Additive Synthesis Engine
 * CONTROL12 Lattice Ops
 *
 * Stable additive synthesis core used by:
 * - platform agents
 * - Avrone Due’Krey chatbot surfaces
 * - local-agent and fabric dashboards
 *
 * Design goals:
 * - Clear separation of state vs. audio rendering
 * - Deterministic partial management with harmonic-series bias
 * - Belief / tension as first-class modulation sources
 * - Safe for both browser (Web Audio API) and future Node backends
 *
 * Perspective note: every parameter is a provisional reading.
 * Always Believe. Never Know.
 */

export class LivingIntermediate {
  constructor(options = {}) {
    this.state = {
      amplitude: options.amplitude ?? 1.0,
      phase: options.phase ?? 0.4390135707716655,
      entropy: options.entropy ?? 1.907e-22,
      belief: options.belief ?? 0.5,
      unlived: options.unlived ?? 0.12,
      // Prefer harmonic series around a carrier (default ~528 Hz lineage)
      harmonics: options.harmonics ?? [528, 1056, 1584, 417, 834, 111],
      surplus: options.surplus ?? 0.0,
      residual: options.residual ?? 0.0,
      carrier: options.carrier ?? 528
    };

    this.lastTimestamp = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    // Audio graph
    this.audioContext = null;
    this.masterGain = null;
    this.oscillators = new Map(); // frequency → { oscillator, gainNode }
    this.isAudioReady = false;

    // Additive synthesis settings
    this.maxPartials = options.maxPartials ?? 16;
    this.baseGainScale = options.baseGainScale ?? 0.16;
    this.harmonicBias = options.harmonicBias ?? 0.72; // preference for integer multiples of carrier
  }

  /**
   * Initialize Web Audio graph.
   * Must be called from a user gesture in browsers.
   */
  async initAudio() {
    if (this.audioContext) return this;

    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) {
      // Node / headless path: state still advances; audio is a no-op.
      this.isAudioReady = false;
      return this;
    }

    this.audioContext = new Ctx();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.audioContext.destination);

    this.isAudioReady = true;
    this.syncOscillators();
    return this;
  }

  /**
   * Create a single sine partial (oscillator + gain).
   */
  createPartial(frequency) {
    if (!this.audioContext) return null;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0;

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start();

    return { oscillator, gainNode };
  }

  /**
   * Keep the set of running partials matched to state.harmonics.
   * Core of the additive synthesis voice allocation.
   */
  syncOscillators() {
    if (!this.isAudioReady || !this.audioContext) return;

    const target = new Set(
      this.state.harmonics
        .slice(0, this.maxPartials)
        .map(f => Number(Number(f).toFixed(1)))
    );

    // Release partials that are no longer needed
    for (const [freq, nodes] of this.oscillators) {
      if (!target.has(freq)) {
        const now = this.audioContext.currentTime;
        nodes.gainNode.gain.cancelScheduledValues(now);
        nodes.gainNode.gain.setValueAtTime(nodes.gainNode.gain.value, now);
        nodes.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        setTimeout(() => {
          try { nodes.oscillator.stop(); } catch {}
          this.oscillators.delete(freq);
        }, 400);
      }
    }

    // Allocate new partials
    for (const frequency of target) {
      if (!this.oscillators.has(frequency)) {
        const nodes = this.createPartial(frequency);
        if (nodes) this.oscillators.set(frequency, nodes);
      }
    }
  }

  /**
   * Optional relational coupling between two belief values.
   */
  calculateRelationalCoupling(otherBelief) {
    if (otherBelief == null || Number.isNaN(otherBelief)) return 0;
    const diff = this.state.belief - otherBelief;
    return 0.015 * Math.cos(diff * Math.PI) * this.state.unlived;
  }

  /**
   * Propose a new partial frequency biased toward the harmonic series of the carrier.
   */
  proposePartialFrequency() {
    const carrier = this.state.carrier || 528;
    const tension = this.state.belief * (1 - this.state.belief);

    if (Math.random() < this.harmonicBias) {
      // Integer or near-integer multiple of carrier
      const n = 2 + Math.floor(Math.random() * 7);
      const micro = (Math.random() - 0.5) * 6 * tension;
      return Number((carrier * n + micro).toFixed(1));
    }

    // Free partial – residual / phase driven
    const base = 180 + (this.state.phase * 22) % 420;
    return Number(base.toFixed(1));
  }

  /**
   * Advance the internal state and drive the additive voice.
   * @param {number} currentBelief  0–1
   * @param {number|null} otherBelief optional second belief for coupling
   */
  tick(currentBelief, otherBelief = null) {
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = now;

    const belief = Math.max(0, Math.min(1, Number(currentBelief) || 0));
    const tension = belief * (1 - belief); // peaks at 0.5
    const beliefVelocity = (belief - this.state.belief) * 2.5;

    // State derivatives
    const dAmplitude = (0.9 + 1.6 * tension) * beliefVelocity * dt;
    const dPhase =
      (2 * Math.PI * (this.state.carrier || 528) * 0.0008 * dt) +
      (this.state.unlived * 0.0005);
    const dEntropy = this.state.unlived * 1.1e-27 * dt;
    const dUnlived = Math.abs(beliefVelocity) * 0.003 * dt;
    const dSurplus = tension * 0.0015 * dt;
    const relational = this.calculateRelationalCoupling(otherBelief);

    // Integrate
    this.state.amplitude = Math.max(0.15, this.state.amplitude + dAmplitude + relational);
    this.state.phase = (this.state.phase + dPhase) % (2 * Math.PI);
    this.state.entropy += dEntropy;
    this.state.belief = belief;
    this.state.unlived += dUnlived;
    this.state.surplus += dSurplus;
    this.state.residual = Math.sin(this.state.phase * 0.07) * 0.00025;

    // Spontaneous partial birth (additive evolution)
    if (tension > 0.2 && this.state.surplus > 0.03 && Math.random() < 0.022) {
      const newFreq = this.proposePartialFrequency();
      if (!this.state.harmonics.includes(newFreq) && this.state.harmonics.length < this.maxPartials) {
        this.state.harmonics.push(newFreq);
      }
    }

    // Soft prune lowest-energy free partials when over budget
    if (this.state.harmonics.length > this.maxPartials) {
      this.state.harmonics = this.state.harmonics
        .slice()
        .sort((a, b) => a - b)
        .slice(0, this.maxPartials);
    }

    this.syncOscillators();
    this.updateAudioParameters();

    return this.getStatusString();
  }

  /**
   * Drive master gain and per-partial gain + detune.
   * Classic additive synthesis amplitude distribution:
   * higher partials receive lower gain (1/sqrt(n)), with belief tilt.
   */
  updateAudioParameters() {
    if (!this.isAudioReady || !this.masterGain || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const belief = this.state.belief;
    const tension = belief * (1 - belief);

    // Master envelope driven by belief + tension
    const targetMaster =
      Math.pow(belief, 1.12) * (0.32 + 0.68 * tension) * this.baseGainScale;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.08);

    // Per-partial parameters
    let index = 0;
    for (const [freq, nodes] of this.oscillators) {
      const partialScale = 1 / Math.sqrt(index + 1);
      const phaseMod = 0.08 + 0.05 * Math.sin(this.state.phase + index * 0.7);
      const beliefMod = 0.55 + 0.45 * belief;

      // Slight spectral tilt: higher belief favors lower partials slightly more
      const spectralTilt = 1 - (index * 0.04 * (1 - belief));

      const targetGain = Math.max(
        0.0006,
        phaseMod * this.state.amplitude * beliefMod * partialScale * spectralTilt
      );

      nodes.gainNode.gain.cancelScheduledValues(now);
      nodes.gainNode.gain.setValueAtTime(nodes.gainNode.gain.value, now);
      nodes.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.1);

      // Subtle detune keeps the additive texture alive
      const detune =
        this.state.residual * 8000 +
        Math.sin(this.state.phase * 0.3 + index) * 3.2 +
        (tension * 1.5);

      nodes.oscillator.detune.cancelScheduledValues(now);
      nodes.oscillator.detune.setValueAtTime(nodes.oscillator.detune.value, now);
      nodes.oscillator.detune.linearRampToValueAtTime(detune, now + 0.15);

      index++;
    }
  }

  getStatusString() {
    const tension = this.state.belief * (1 - this.state.belief);
    return [
      `amp=${this.state.amplitude.toFixed(3)}`,
      `belief=${this.state.belief.toFixed(3)}`,
      `tension=${tension.toFixed(3)}`,
      `partials=${this.state.harmonics.length}`,
      `surplus=${this.state.surplus.toFixed(4)}`
    ].join(' | ');
  }

  /**
   * Fade all partials to silence.
   */
  silence() {
    if (!this.masterGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 0.45);
  }

  /**
   * Snapshot of current state for agents / observability.
   */
  getState() {
    return {
      ...this.state,
      harmonics: [...this.state.harmonics],
      tension: this.state.belief * (1 - this.state.belief),
      audioReady: this.isAudioReady,
      partialCount: this.oscillators.size
    };
  }

  /**
   * Spectrum summary for agent / LLM context injection.
   */
  getSpectrum() {
    return {
      carrier: this.state.carrier,
      partials: this.state.harmonics.slice(0, this.maxPartials),
      belief: this.state.belief,
      tension: this.state.belief * (1 - this.state.belief),
      amplitude: this.state.amplitude,
      residual: this.state.residual
    };
  }
}

export default LivingIntermediate;
