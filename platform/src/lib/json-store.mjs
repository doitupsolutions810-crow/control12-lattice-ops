import fs from "node:fs/promises";
import path from "node:path";

export class JsonStore {
  constructor(file, initialValue) {
    this.file = file;
    this.initialValue = initialValue;
    this.queue = Promise.resolve();
  }

  async read() {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return structuredClone(this.initialValue);
    }
  }

  async write(value) {
    this.queue = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(tmp, this.file);
    });
    return this.queue;
  }

  async update(mutator) {
    const current = await this.read();
    const next = await mutator(current);
    await this.write(next);
    return next;
  }
}

export async function appendJsonLine(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(value)}\n`, { mode: 0o600 });
}
