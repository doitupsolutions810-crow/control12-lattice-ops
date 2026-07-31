/**
 * Seed the multi-belief field with core lattice roles.
 */

const DEFAULT_NODES = [
  { id: 'operator', belief: 0.5, label: 'operator' },
  { id: 'avrone', belief: 0.55, label: 'avrone' },
  { id: 'planner', belief: 0.5, label: 'planner' },
  { id: 'engineer', belief: 0.5, label: 'engineer' },
  { id: 'verifier', belief: 0.5, label: 'verifier' },
  { id: 'coder', belief: 0.5, label: 'coder' }
];

/** Role mesh: avrone coupled to operator; agents coupled in a ring. */
const DEFAULT_EDGES = [
  ['avrone', 'operator', 1.5],
  ['avrone', 'planner', 1],
  ['planner', 'engineer', 1],
  ['engineer', 'coder', 1],
  ['coder', 'verifier', 1],
  ['verifier', 'operator', 1]
];

export function seedBeliefField(beliefGraph, options = {}) {
  const nodes = options.nodes || DEFAULT_NODES;
  const edges = options.edges || DEFAULT_EDGES;
  const seeded = { nodes: [], edges: [] };

  for (const n of nodes) {
    seeded.nodes.push(beliefGraph.upsertNode(n.id, { belief: n.belief, label: n.label }));
  }
  for (const [a, b, weight] of edges) {
    try {
      seeded.edges.push(beliefGraph.link(a, b, weight));
    } catch {
      // ignore missing / duplicate
    }
  }

  let tick = null;
  if (options.tick !== false) {
    tick = beliefGraph.tickAll();
  }

  return { seeded, tick, snapshot: beliefGraph.snapshot() };
}

export { DEFAULT_NODES, DEFAULT_EDGES };
export default seedBeliefField;
