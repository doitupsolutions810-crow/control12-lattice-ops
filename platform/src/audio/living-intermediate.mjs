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
 * - Deterministic partial management
 * - Belief / tension as first-class modulation sources
 * - Safe for both browser (Web Audio API) and future Node backends
 */

export class LivingIntermediate {
  constructor(options = {}) {
    this.state = {
      amplitude: options.amplitude ?? 1.0,
      phase: options.phase ?? 0.4390135707716655,
      entropy: options.entropy ?? 1.907e-22,
      belief: options.belief ?? 0.5,
      unlived: options.unlived ?? 0.12,
      harmonics: options.harmonics ?? [528, 417, 111],
      surplus: options.surplus ?? 0.0,
      residual: options.residual ?? 0.0
    };

    this.lastTimestamp = performance.now?.() ?? Date.now();

    // Audio graph
    this.audioContext = null;
    this.masterGain = null;
    this.oscillators = new Map(); // frequency → { oscillator, gainNode }
    this.isAudioReady = false;

    // Additive synthesis settings
    this.maxPartials = options.maxPartials ?? 12;
    this.baseGainScale = options.baseGainScale ?? 0.18;
  }

  /**
   * Initialize Web Audio graph.
   * Must be called from a user gesture in browsers.
   */
  async initAudio() {
    if (this.audioContext) return this;

    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) {
      throw new Error('Web Audio API not available in this environment');
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
   * This is the core of the additive synthesis voice allocation.
   */
  syncOscillators() {
    if (!this.isAudioReady) return;

    const target = new Set(
      this.state.harmonics
        .slice(0, this.maxPartials)
        .map(f => Number(f.toFixed(1)))
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
    if (otherBelief == null) return 0;
    const diff = this.state.belief - otherBelief;
    return 0.015 * Math.cos(diff * Math.PI) * this.state.unlived;
  }

  /**
   * Advance the internal state and drive the additive voice.
   * @param {number} currentBelief  0–1
   * @param {number|null} otherBelief optional second belief for coupling
   */
  tick(currentBelief, otherBelief = null) {
    const now = performance.now?.() ?? Date.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = now;

    const belief = Math.max(0, Math.min(1, currentBelief));
    const tension = belief * (1 - belief);          // peaks at 0.5
    const beliefVelocity = (belief - this.state.belief) * 2.5;

    // State derivatives
    const dAmplitude = (0.9 + 1.6 * tension) * beliefVelocity * dt;
    const dPhase =
      (2 * Math.PI * 528 * 0.0008 * dt) +
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
    if (tension > 0.22 && this.state.surplus > 0.035 && Math.random() < 0.018) {
      const newFreq = Number((260 + (this.state.phase * 18) % 95).toFixed(1));
      if (!this.state.harmonics.includes(newFreq) && this.state.harmonics.length < this.maxPartials) {
        this.state.harmonics.push(newFreq);
      }
    }

    this.syncOscillators();
    this.updateAudioParameters();

    return this.getStatusString();
  }

  /**
   * Drive master gain and per-partial gain + detune.
   * Classic additive synthesis amplitude distribution:
   * higher partials receive lower gain (1/sqrt(n)).
   */
  updateAudioParameters() {
    if (!this.isAudioReady || !this.masterGain) return;

    const now = this.audioContext.currentTime;
    const belief = this.state.belief;
    const tension = belief * (1 - belief);

    // Master envelope driven by belief + tension
    const targetMaster =
      Math.pow(belief, 1.15) * (0.35 + 0.65 * tension) * this.baseGainScale;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.08);

    // Per-partial parameters
    let index = 0;
    for (const [freq, nodes] of this.oscillators) {
      // Amplitude falls with partial number (classic additive shaping)
      const partialScale = 1 / Math.sqrt(index + 1);
      const phaseMod = 0.09 + 0.04 * Math.sin(this.state.phase + index);
      const beliefMod = 0.6 + 0.4 * belief;

      const targetGain = Math.max(
        0.0008,
        phaseMod * this.state.amplitude * beliefMod * partialScale
      );

      nodes.gainNode.gain.cancelScheduledValues(now);
      nodes.gainNode.gain.setValueAtTime(nodes.gainNode.gain.value, now);
      nodes.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.1);

      // Subtle detune keeps the additive texture alive
      const detune =
        this.state.residual * 8000 +
        Math.sin(this.state.phase * 0.3 + index) * 3.5;

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
    return { ...this.state, harmonics: [...this.state.harmonics] };
  }
}

export default LivingIntermediate;
