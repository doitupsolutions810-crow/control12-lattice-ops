import fs from "node:fs/promises";
import path from "node:path";
import { canonicalJson, randomId, sha256 } from "../lib/hash.mjs";

export class ArtifactBuilder {
  constructor({ artifactDir, bus }) {
    this.artifactDir = artifactDir;
    this.bus = bus;
  }

  async build({ name, type, payload, provenance = {} }) {
    if (!name || !type) throw new Error("artifact name and type are required");
    const id = randomId("artifact");
    const createdAt = new Date().toISOString();
    const payloadDigest = sha256(payload);
    const manifest = {
      schema: "control12.artifact/v1",
      id,
      name,
      type,
      createdAt,
      payloadDigest,
      provenance
    };
    manifest.digest = sha256(manifest);
    const directory = path.join(this.artifactDir, id);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(directory, "payload.json"), `${canonicalJson(payload)}\n`, { mode: 0o600 });
    await fs.writeFile(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await this.bus.publish("artifact.created", manifest);
    return { ...manifest, path: directory };
  }
}
