import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { canonical, sha256 } from "../lib/canonical.mjs";

export class PluginRegistry {
  constructor({ dir, secret, bus }) { this.dir = dir; this.secret = secret; this.bus = bus; this.plugins = new Map(); }
  sign(manifest) { const { integrity, ...body } = manifest; return crypto.createHmac("sha256", this.secret).update(canonical(body)).digest("hex"); }
  verify(manifest) { return manifest.builtin === true || (manifest.integrity?.algorithm === "hmac-sha256" && manifest.integrity?.signature === this.sign(manifest)); }
  validate(manifest) {
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(manifest.id || "")) throw new Error("invalid plugin id");
    if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.length) throw new Error("plugin capabilities required");
    for (const host of manifest.allowedHosts || []) if (!/^[a-z0-9.-]+$/.test(host)) throw new Error("invalid allowed host");
    if (!this.verify(manifest)) throw new Error("plugin integrity verification failed");
    return manifest;
  }
  async loadBuiltins(sourceDir) {
    await fs.mkdir(this.dir, { recursive: true });
    for (const name of await fs.readdir(sourceDir)) if (name.endsWith(".json")) { const manifest = this.validate(JSON.parse(await fs.readFile(path.join(sourceDir, name), "utf8"))); this.plugins.set(manifest.id, manifest); }
    return this.list();
  }
  async register(manifest, actor = "system") {
    this.validate(manifest); await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, `${manifest.id}.json`), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 }); this.plugins.set(manifest.id, manifest);
    await this.bus.publish({ tenant: manifest.tenant || "system", type: "plugin.registered", actor, payload: { id: manifest.id, digest: sha256(manifest) } }); return manifest;
  }
  list() { return [...this.plugins.values()]; }
  get(id) { return this.plugins.get(id) || null; }
}
