import fs from "node:fs/promises";
import path from "node:path";

export class AtomicJsonStore {
  #queue = Promise.resolve();
  constructor(file, initial = {}) { this.file = file; this.initial = initial; }
  async read() {
    try { return JSON.parse(await fs.readFile(this.file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return structuredClone(this.initial); throw error; }
  }
  async write(value) {
    const task = this.#queue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(tmp, this.file);
    });
    this.#queue = task.catch(() => {});
    return task;
  }
  async update(mutator) {
    let result;
    const task = this.#queue.catch(() => {}).then(async () => {
      const value = await this.read();
      result = await mutator(value);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(tmp, this.file);
    });
    this.#queue = task.catch(() => {});
    await task;
    return result;
  }
}
