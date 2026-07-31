import { JsonStore } from "../lib/json-store.mjs";
import { sha256 } from "../lib/hash.mjs";

export class ComponentRegistry {
  constructor(file) {
    this.store = new JsonStore(file, { schema: "control12.registry/v1", components: {} });
  }

  async register(component) {
    for (const key of ["id", "version", "kind"]) {
      if (!component[key]) throw new Error(`component.${key} is required`);
    }
    const normalized = {
      ...component,
      capabilities: [...new Set(component.capabilities || [])].sort(),
      registeredAt: new Date().toISOString()
    };
    normalized.digest = sha256(normalized);
    await this.store.update(state => {
      state.components[component.id] = normalized;
      return state;
    });
    return normalized;
  }

  async list() {
    return Object.values((await this.store.read()).components);
  }

  async get(id) {
    return (await this.store.read()).components[id] || null;
  }
}
