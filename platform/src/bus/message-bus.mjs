import { EventEmitter } from "node:events";
import { appendJsonLine } from "../lib/json-store.mjs";
import { randomId, sha256 } from "../lib/hash.mjs";

export class MessageBus {
  constructor({ eventFile }) {
    this.events = new EventEmitter({ captureRejections: true });
    this.eventFile = eventFile;
    this.sequence = 0;
  }

  subscribe(topic, handler) {
    this.events.on(topic, handler);
    return () => this.events.off(topic, handler);
  }

  async publish(topic, payload, metadata = {}) {
    const event = {
      id: randomId("evt"),
      sequence: ++this.sequence,
      topic,
      observedAt: new Date().toISOString(),
      payload,
      metadata
    };
    event.digest = sha256(event);
    await appendJsonLine(this.eventFile, event);
    this.events.emit(topic, event);
    this.events.emit("*", event);
    return event;
  }
}
