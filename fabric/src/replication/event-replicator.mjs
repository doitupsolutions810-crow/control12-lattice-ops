export class EventReplicator {
  constructor({ endpoint = "", token = "", maxQueue = 10000 }) {
    this.endpoint = endpoint;
    this.token = token;
    this.maxQueue = maxQueue;
    this.queue = [];
    this.running = false;
    this.stats = { enqueued: 0, delivered: 0, failed: 0, dropped: 0, lastError: null };
  }
  enabled() { return Boolean(this.endpoint && this.token); }
  enqueue(event) {
    if (!this.enabled()) return;
    if (this.queue.length >= this.maxQueue) { this.queue.shift(); this.stats.dropped += 1; }
    this.queue.push({ event, attempts: 0 }); this.stats.enqueued += 1;
    if (!this.running) void this.drain();
  }
  async drain() {
    this.running = true;
    while (this.queue.length) {
      const item = this.queue[0]; item.attempts += 1;
      try {
        const response = await fetch(this.endpoint, { method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" }, body: JSON.stringify(item.event), signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`replication HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
        this.queue.shift(); this.stats.delivered += 1; this.stats.lastError = null;
      } catch (error) {
        this.stats.failed += 1; this.stats.lastError = error.message;
        if (item.attempts >= 8) { this.queue.shift(); this.stats.dropped += 1; }
        else await new Promise(resolve => setTimeout(resolve, Math.min(250 * 2 ** item.attempts, 30000)));
      }
    }
    this.running = false;
  }
  snapshot() { return { enabled: this.enabled(), queued: this.queue.length, ...this.stats }; }
}
