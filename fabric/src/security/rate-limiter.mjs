export class RateLimiter {
  constructor({ limit = 240, windowMs = 60_000 } = {}) { this.limit = limit; this.windowMs = windowMs; this.entries = new Map(); }
  consume(key) {
    const now = Date.now();
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) { this.entries.set(key, { count: 1, resetAt: now + this.windowMs }); return { remaining: this.limit - 1, resetAt: now + this.windowMs }; }
    current.count += 1;
    if (current.count > this.limit) throw Object.assign(new Error("rate limit exceeded"), { statusCode: 429, retryAfter: Math.ceil((current.resetAt - now) / 1000) });
    return { remaining: this.limit - current.count, resetAt: current.resetAt };
  }
}
