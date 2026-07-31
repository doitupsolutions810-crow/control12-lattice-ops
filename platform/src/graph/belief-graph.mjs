/**
 * BeliefGraph – multi-node belief field with relational coupling
 *
 * Each node holds a belief in [0,1]. Edges carry optional weight.
 * tickAll advances ResonantBridge using mean neighbor belief as otherBelief.
 */

export class BeliefGraph {
  constructor({ resonant = null, maxNodes = 32 } = {}) {
    this.resonant = resonant;
    this.maxNodes = maxNodes;
    this.nodes = new Map(); // id -> { id, belief, label, updatedAt }
    this.edges = new Map(); // key "a|b" (sorted) -> { a, b, weight }
  }

  upsertNode(id, { belief = 0.5, label = null } = {}) {
    if (!id || typeof id !== 'string') {
      throw Object.assign(new Error('node id is required'), { statusCode: 400 });
    }
    if (this.nodes.size >= this.maxNodes && !this.nodes.has(id)) {
      throw Object.assign(new Error(`max nodes (${this.maxNodes}) reached`), { statusCode: 400 });
    }
    const B = Math.max(0, Math.min(1, Number(belief) || 0));
    const node = {
      id,
      belief: B,
      label: label ?? id,
      updatedAt: new Date().toISOString()
    };
    this.nodes.set(id, node);
    return node;
  }

  link(a, b, weight = 1) {
    if (!this.nodes.has(a) || !this.nodes.has(b)) {
      throw Object.assign(new Error('both nodes must exist before linking'), { statusCode: 400 });
    }
    if (a === b) {
      throw Object.assign(new Error('self-edges are not allowed'), { statusCode: 400 });
    }
    const [x, y] = a < b ? [a, b] : [b, a];
    const key = `${x}|${y}`;
    const edge = { a: x, b: y, weight: Number(weight) || 1, updatedAt: new Date().toISOString() };
    this.edges.set(key, edge);
    return edge;
  }

  neighbors(id) {
    const out = [];
    for (const edge of this.edges.values()) {
      if (edge.a === id) out.push({ id: edge.b, weight: edge.weight });
      else if (edge.b === id) out.push({ id: edge.a, weight: edge.weight });
    }
    return out;
  }

  /** Weighted mean of neighbor beliefs; null if no neighbors. */
  meanNeighborBelief(id) {
    const neigh = this.neighbors(id);
    if (!neigh.length) return null;
    let sum = 0;
    let wsum = 0;
    for (const n of neigh) {
      const node = this.nodes.get(n.id);
      if (!node) continue;
      sum += node.belief * n.weight;
      wsum += n.weight;
    }
    if (wsum <= 0) return null;
    return sum / wsum;
  }

  /**
   * Advance every node through ResonantBridge when present.
   * Uses mean neighbor belief as otherBelief for coupling.
   */
  tickAll() {
    const snapshots = [];
    for (const node of this.nodes.values()) {
      const other = this.meanNeighborBelief(node.id);
      let resonantSnap = null;
      if (this.resonant) {
        resonantSnap = this.resonant.tick(node.belief, other);
      }
      snapshots.push({
        id: node.id,
        belief: node.belief,
        otherBelief: other,
        resonant: resonantSnap
      });
    }
    return {
      at: new Date().toISOString(),
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      snapshots
    };
  }

  setBelief(id, belief) {
    const node = this.nodes.get(id);
    if (!node) {
      throw Object.assign(new Error(`unknown node: ${id}`), { statusCode: 404 });
    }
    node.belief = Math.max(0, Math.min(1, Number(belief) || 0));
    node.updatedAt = new Date().toISOString();
    return node;
  }

  snapshot() {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      meanBelief: this.nodes.size
        ? [...this.nodes.values()].reduce((s, n) => s + n.belief, 0) / this.nodes.size
        : null
    };
  }

  toPromptFragment() {
    const s = this.snapshot();
    const nodePart = s.nodes
      .slice(0, 12)
      .map(n => `${n.id}=${n.belief.toFixed(3)}`)
      .join(', ');
    return [
      '[BeliefGraph]',
      `nodes=${s.nodes.length}`,
      `edges=${s.edges.length}`,
      `mean=${s.meanBelief != null ? s.meanBelief.toFixed(3) : 'n/a'}`,
      `field={${nodePart}}`
    ].join(' ');
  }
}

export default BeliefGraph;
