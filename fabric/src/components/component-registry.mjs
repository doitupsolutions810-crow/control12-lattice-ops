import path from "node:path";
import { AtomicJsonStore } from "../lib/atomic-store.mjs";
import { randomId, sha256 } from "../lib/canonical.mjs";

export class ComponentRegistry {
  constructor(stateDir, bus) { this.store = new AtomicJsonStore(path.join(stateDir, "components.json"), { components: [] }); this.bus = bus; }
  async register({ tenant, id = randomId("cmp"), kind, version, capabilities = [], metadata = {} }, actor = "system") {
    const component = { tenant, id, kind, version, capabilities: [...new Set(capabilities)].sort(), metadata, digest: sha256({ tenant, id, kind, version, capabilities, metadata }), registeredAt: new Date().toISOString() };
    await this.store.update(value => { const index = value.components.findIndex(x => x.tenant === tenant && x.id === id); if (index >= 0) value.components[index] = component; else value.components.push(component); return component; });
    await this.bus.publish({ tenant, type: "component.registered", actor, payload: component }); return component;
  }
  async list(tenant) { return (await this.store.read()).components.filter(x => x.tenant === tenant); }
}
