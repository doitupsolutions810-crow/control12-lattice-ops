import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BeliefGraph } from '../src/graph/belief-graph.mjs';
import { ResonantBridge } from '../src/audio/resonant-bridge.mjs';

describe('BeliefGraph', () => {
  it('stores nodes and weighted edges', () => {
    const g = new BeliefGraph();
    g.upsertNode('a', { belief: 0.4 });
    g.upsertNode('b', { belief: 0.8 });
    g.link('a', 'b', 2);
    assert.equal(g.meanNeighborBelief('a'), 0.8);
    assert.equal(g.snapshot().edges.length, 1);
  });

  it('ticks through resonant with neighbor coupling', () => {
    const resonant = new ResonantBridge({ label: 'test' });
    const g = new BeliefGraph({ resonant });
    g.upsertNode('avrone', { belief: 0.55 });
    g.upsertNode('operator', { belief: 0.35 });
    g.link('avrone', 'operator');
    const out = g.tickAll();
    assert.equal(out.nodeCount, 2);
    assert.ok(out.snapshots[0].resonant);
  });

  it('rejects self-edge', () => {
    const g = new BeliefGraph();
    g.upsertNode('x', { belief: 0.5 });
    assert.throws(() => g.link('x', 'x'), /self-edges/);
  });
});
