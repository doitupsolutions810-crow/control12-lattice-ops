/**
 * Slow Jacobian tuning from outcome logs (path 5).
 * Stores coupling/gain weights; apply as soft multipliers — never claims convergence.
 */

import { JsonStore } from '../lib/json-store.mjs';

const DEFAULTS = {
  couplingGain: 1,
  tensionGain: 1,
  beliefStepScale: 1,
  samples: 0
};

export class JacobianTune {
  constructor(file) {
    this.store = new JsonStore(file, {
      schema: 'control12.jacobian-tune/v1',
      weights: { ...DEFAULTS },
      outcomes: []
    });
  }

  async getWeights() {
    return (await this.store.read()).weights;
  }

  /**
   * Record an outcome: human or verifier accept/reject after a belief/quorum step.
   * Very small adaptation — provisional.
   */
  async recordOutcome({ accepted, tension = 0.25, belief = 0.5 }) {
    return this.store.update(s => {
      s.outcomes.push({
        at: new Date().toISOString(),
        accepted: Boolean(accepted),
        tension,
        belief
      });
      if (s.outcomes.length > 200) s.outcomes = s.outcomes.slice(-200);

      const w = s.weights;
      w.samples = (w.samples || 0) + 1;
      const delta = accepted ? 0.01 : -0.01;
      // Soft updates bounded
      w.couplingGain = clamp(w.couplingGain + delta * (0.5 - Math.abs(belief - 0.5)), 0.5, 1.5);
      w.tensionGain = clamp(w.tensionGain + delta * tension, 0.5, 1.5);
      w.beliefStepScale = clamp(w.beliefStepScale + delta * 0.5, 0.5, 1.5);
      return s;
    }).then(s => s.weights);
  }
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

export default JacobianTune;
