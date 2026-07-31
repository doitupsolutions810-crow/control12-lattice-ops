import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LivingIntermediate } from '../src/audio/living-intermediate.mjs';
import { ResonantBridge } from '../src/audio/resonant-bridge.mjs';

describe('LivingIntermediate additive core', () => {
  it('advances belief and reports status', () => {
    const voice = new LivingIntermediate({ belief: 0.4 });
    const status = voice.tick(0.55);
    assert.ok(typeof status === 'string');
    assert.ok(status.includes('belief=0.550'));
    const state = voice.getState();
    assert.equal(state.belief, 0.55);
    assert.ok(state.harmonics.length >= 1);
  });

  it('proposes partials without requiring Web Audio', () => {
    const voice = new LivingIntermediate();
    for (let i = 0; i < 5; i++) voice.tick(0.5 + i * 0.05);
    const spectrum = voice.getSpectrum();
    assert.ok(Array.isArray(spectrum.partials));
    assert.ok(spectrum.carrier > 0);
  });
});

describe('ResonantBridge agent surface', () => {
  it('ticks and emits prompt fragment', () => {
    const bridge = new ResonantBridge({ label: 'test' });
    const snap = bridge.tick(0.62);
    assert.equal(snap.state.belief, 0.62);
    const frag = bridge.toPromptFragment();
    assert.ok(frag.includes('ResonantBridge:test'));
    assert.ok(frag.includes('belief=0.620'));
  });

  it('keeps bounded history', () => {
    const bridge = new ResonantBridge({ maxHistory: 3 });
    bridge.tick(0.3);
    bridge.tick(0.4);
    bridge.tick(0.5);
    bridge.tick(0.6);
    assert.equal(bridge.getHistory().length, 3);
  });
});
