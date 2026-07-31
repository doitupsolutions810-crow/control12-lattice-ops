import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBeliefJacobian, integrateBeliefStep } from '../src/audio/jacobian.mjs';
import { LivingIntermediate } from '../src/audio/living-intermediate.mjs';

describe('Belief Jacobian', () => {
  it('peaks tension at belief 0.5', () => {
    const J = evaluateBeliefJacobian({ belief: 0.5, amplitude: 1, unlived: 0.1, phase: 0 }, 0);
    assert.ok(Math.abs(J.T - 0.25) < 1e-9);
    assert.ok(Math.abs(J.dT_dB) < 1e-9);
  });

  it('integrates a belief step without audio', () => {
    const state = {
      amplitude: 1,
      phase: 0.4,
      entropy: 0,
      belief: 0.4,
      unlived: 0.1,
      surplus: 0,
      residual: 0,
      carrier: 528,
      harmonics: [528]
    };
    const { next, tension } = integrateBeliefStep(state, 0.6, 0.02);
    assert.equal(next.belief, 0.6);
    assert.ok(next.amplitude >= 0.15);
    assert.ok(tension > 0);
  });
});

describe('LivingIntermediate + Jacobian', () => {
  it('exposes jacobian row on state after tick', () => {
    const voice = new LivingIntermediate({ belief: 0.3 });
    voice.tick(0.55);
    const state = voice.getState();
    assert.ok(state.jacobian);
    assert.ok('dAmp_dB_approx' in state.jacobian);
  });
});
