export class Metrics {
  constructor() { this.counters = new Map(); this.gauges = new Map(); }
  inc(name, labels = {}, value = 1) { const key = this.key(name, labels); this.counters.set(key, (this.counters.get(key) || 0) + value); }
  set(name, labels = {}, value = 0) { this.gauges.set(this.key(name, labels), value); }
  key(name, labels) { const pairs = Object.entries(labels).sort().map(([k,v]) => `${k}="${String(v).replaceAll('"','\\"')}"`).join(","); return pairs ? `${name}{${pairs}}` : name; }
  render() { return [...this.counters, ...this.gauges].map(([key,value]) => `${key} ${value}`).join("\n") + "\n"; }
}
