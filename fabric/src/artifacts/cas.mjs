import fs from "node:fs/promises";
import path from "node:path";
import { canonical, randomId, sha256 } from "../lib/canonical.mjs";

export class ArtifactCAS {
  constructor(root, bus) { this.root = root; this.bus = bus; }
  async put({ tenant, name, mediaType = "application/octet-stream", content, provenance = {} }) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(typeof content === "string" ? content : canonical(content));
    const digest = sha256(bytes); const hex = digest.slice(7); const dir = path.join(this.root, tenant, hex.slice(0, 2));
    await fs.mkdir(dir, { recursive: true });
    const blob = path.join(dir, hex); try { await fs.writeFile(blob, bytes, { flag: "wx", mode: 0o600 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
    const manifest = { id: randomId("art"), tenant, name, mediaType, digest, size: bytes.length, createdAt: new Date().toISOString(), provenance, blob };
    await fs.writeFile(`${blob}.json`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await this.bus.publish({ tenant, type: "artifact.created", payload: manifest }); return manifest;
  }
  async get(tenant, digest) { const hex = digest.replace(/^sha256:/, ""); const manifest = JSON.parse(await fs.readFile(path.join(this.root, tenant, hex.slice(0, 2), `${hex}.json`), "utf8")); return manifest; }
}
