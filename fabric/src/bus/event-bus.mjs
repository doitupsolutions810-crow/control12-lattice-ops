export class EventBus {
  constructor(ledger) { this.ledger = ledger; this.listeners = new Map(); }
  subscribe(type, listener) {
    const set = this.listeners.get(type) || new Set(); set.add(listener); this.listeners.set(type, set);
    return () => set.delete(listener);
  }
  async publish(event) {
    const record = await this.ledger.append(event);
    for (const type of [record.type, "*"]) for (const listener of this.listeners.get(type) || []) await listener(record);
    return record;
  }
}
