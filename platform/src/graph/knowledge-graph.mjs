import { JsonStore } from "../lib/json-store.mjs";

export class KnowledgeGraph {
  constructor(file) {
    this.store = new JsonStore(file, { schema: "control12.graph/v1", nodes: {}, edges: [] });
  }

  async upsertNode(node) {
    if (!node.id || !node.type) throw new Error("node.id and node.type are required");
    return this.store.update(graph => {
      graph.nodes[node.id] = { ...graph.nodes[node.id], ...node, updatedAt: new Date().toISOString() };
      return graph;
    }).then(graph => graph.nodes[node.id]);
  }

  async link(from, relation, to, attributes = {}) {
    return this.store.update(graph => {
      if (!graph.nodes[from] || !graph.nodes[to]) throw new Error("both graph nodes must exist");
      const key = `${from}|${relation}|${to}`;
      graph.edges = graph.edges.filter(edge => edge.key !== key);
      graph.edges.push({ key, from, relation, to, attributes, observedAt: new Date().toISOString() });
      return graph;
    }).then(graph => graph.edges.at(-1));
  }

  async neighbors(id) {
    const graph = await this.store.read();
    return graph.edges.filter(edge => edge.from === id || edge.to === id);
  }

  async snapshot() {
    return this.store.read();
  }
}
