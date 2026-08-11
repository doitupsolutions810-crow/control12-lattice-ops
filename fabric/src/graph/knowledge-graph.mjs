import path from "node:path";
import { AtomicJsonStore } from "../lib/atomic-store.mjs";

export class KnowledgeGraph {
  constructor(stateDir) { this.store = new AtomicJsonStore(path.join(stateDir, "graph.json"), { nodes: [], edges: [] }); }
  async upsertNode(tenant, node) { return this.store.update(value => { const item = { ...node, tenant, updatedAt: new Date().toISOString() }; const i = value.nodes.findIndex(x => x.tenant === tenant && x.id === node.id); if (i >= 0) value.nodes[i] = item; else value.nodes.push(item); return item; }); }
  async link(tenant, edge) { return this.store.update(value => { const item = { ...edge, tenant, observedAt: new Date().toISOString() }; if (!value.edges.some(x => x.tenant === tenant && x.source === edge.source && x.target === edge.target && x.type === edge.type)) value.edges.push(item); return item; }); }
  async snapshot(tenant) { const value = await this.store.read(); return { nodes: value.nodes.filter(x => x.tenant === tenant), edges: value.edges.filter(x => x.tenant === tenant) }; }
}
