import fs from "node:fs/promises";
import path from "node:path";
import { canonical, sha256 } from "../lib/canonical.mjs";

export class HashChainLog {
  #queue = Promise.resolve();
  constructor(file) { this.file = file; }
  async readAll() {
    try { return (await fs.readFile(this.file, "utf8")).split("\n").filter(Boolean).map(JSON.parse); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  async append({ tenant, type, actor = "system", payload = {} }) {
    let record;
    this.#queue = this.#queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const records = await this.readAll();
      const previous = records.at(-1);
      const base = { seq: (previous?.seq || 0) + 1, observedAt: new Date().toISOString(), tenant, type, actor, payload, prevHash: previous?.hash || null };
      record = { ...base, hash: sha256(canonical(base)) };
      await fs.appendFile(this.file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    });
    await this.#queue;
    return record;
  }
  async tail(limit = 100) { return (await this.readAll()).slice(-Math.min(Math.max(limit, 1), 2000)); }
  async verify() {
    const records = await this.readAll();
    let previous = null;
    for (const record of records) {
      const { hash, ...base } = record;
      if (base.prevHash !== previous) return { ok: false, seq: record.seq, reason: "previous hash mismatch" };
      if (sha256(canonical(base)) !== hash) return { ok: false, seq: record.seq, reason: "record hash mismatch" };
      previous = hash;
    }
    return { ok: true, records: records.length, head: previous };
  }
}
