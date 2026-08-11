/**
 * LivingIntermediate – Additive Synthesis Engine
 * CONTROL12 Lattice Ops
 *
 * Additive synthesis core used by:
 * - platform agents
 * - Avrone Due’Krey chatbot surfaces
 * - local-agent and fabric dashboards
 *
 * Integrates an explicit Jacobian of belief (see jacobian.mjs).
 */

import { integrateBeliefStep } from './jacobian.mjs';

export class LivingIntermediate {
  constructor(options = {}) {
    this.state = {
      amplitude: options.amplitude ?? 1.0,
      phase: options.phase ?? 0.4390135707716655,
      entropy: options.entropy ?? 1.907e-22,
      belief: options.belief ?? 0.5,
      unlived: options.unlived ?? 0.12,
      harmonics: options.harmonics ?? [528, 1056, 1584, 417, 834, 111],
      surplus: options.surplus ?? 0.0,
      residual: options.residual ?? 0.0,
      carrier: options.carrier ?? 528
    };

    this.lastTimestamp = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    this.audioContext = null;
    this.masterGain = null;
    this.oscillators = new Map();
    this.isAudioReady = false;

    this.maxPartials = options.maxPartials ?? 16;
    this.baseGainScale = options.baseGainScale ?? 0.16;
    this.harmonicBias = options.harmonicBias ?? 0.72;
    this.lastJacobian = null;
  }

  async initAudio() {
    if (this.audioContext) return this;

    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) {
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

  syncOscillators() {
    if (!this.isAudioReady || !this.audioContext) return;

    const target = new Set(
      this.state.harmonics
        .slice(0, this.maxPartials)
        .map(f => Number(Number(f).toFixed(1)))
    );

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

    for (const frequency of target) {
      if (!this.oscillators.has(frequency)) {
        const nodes = this.createPartial(frequency);
        if (nodes) this.oscillators.set(frequency, nodes);
      }
    }
  }

  proposePartialFrequency() {
    const carrier = this.state.carrier || 528;
    const tension = this.state.belief * (1 - this.state.belief);

    if (Math.random() < this.harmonicBias) {
      const n = 2 + Math.floor(Math.random() * 7);
      const micro = (Math.random() - 0.5) * 6 * tension;
      return Number((carrier * n + micro).toFixed(1));
    }

    const base = 180 + (this.state.phase * 22) % 420;
    return Number(base.toFixed(1));
  }

  tick(currentBelief, otherBelief = null) {
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    const dt = Math.min((now - this.lastTimestamp) / 1000, 0.05);
    this.lastTimestamp = now;

    const { next, jacobian, tension } = integrateBeliefStep(
      this.state,
      currentBelief,
      dt,
      otherBelief
    );

    this.state = { ...this.state, ...next };
    this.lastJacobian = jacobian;

    if (tension > 0.2 && this.state.surplus > 0.03 && Math.random() < 0.022) {
      const newFreq = this.proposePartialFrequency();
      if (!this.state.harmonics.includes(newFreq) && this.state.harmonics.length < this.maxPartials) {
        this.state.harmonics.push(newFreq);
      }
    }

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

  updateAudioParameters() {
    if (!this.isAudioReady || !this.masterGain || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    const belief = this.state.belief;
    const tension = belief * (1 - belief);

    const targetMaster =
      Math.pow(belief, 1.12) * (0.32 + 0.68 * tension) * this.baseGainScale;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(targetMaster, now + 0.08);

    let index = 0;
    for (const [, nodes] of this.oscillators) {
      const partialScale = 1 / Math.sqrt(index + 1);
      const phaseMod = 0.08 + 0.05 * Math.sin(this.state.phase + index * 0.7);
      const beliefMod = 0.55 + 0.45 * belief;
      const spectralTilt = 1 - (index * 0.04 * (1 - belief));

      const targetGain = Math.max(
        0.0006,
        phaseMod * this.state.amplitude * beliefMod * partialScale * spectralTilt
      );

      nodes.gainNode.gain.cancelScheduledValues(now);
      nodes.gainNode.gain.setValueAtTime(nodes.gainNode.gain.value, now);
      nodes.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.1);

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

  silence() {
    if (!this.masterGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + 0.45);
  }

  getState() {
    return {
      ...this.state,
      harmonics: [...this.state.harmonics],
      tension: this.state.belief * (1 - this.state.belief),
      audioReady: this.isAudioReady,
      partialCount: this.oscillators.size,
      jacobian: this.lastJacobian?.row ?? null
    };
  }

  getSpectrum() {
    return {
      carrier: this.state.carrier,
      partials: this.state.harmonics.slice(0, this.maxPartials),
      belief: this.state.belief,
      tension: this.state.belief * (1 - this.state.belief),
      amplitude: this.state.amplitude,
      residual: this.state.residual,
      jacobian: this.lastJacobian?.row ?? null
    };
  }
}

export default LivingIntermediate;
