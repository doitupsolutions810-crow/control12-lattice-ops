import path from "node:path";
import { AtomicJsonStore } from "../lib/atomic-store.mjs";
import { randomId } from "../lib/canonical.mjs";

export class WorkerRegistry {
  constructor(stateDir, bus, { leaseMs = 60000, staleMs = 120000 } = {}) { this.store = new AtomicJsonStore(path.join(stateDir, "workers.json"), { workers: [], tasks: [] }); this.bus = bus; this.leaseMs = leaseMs; this.staleMs = staleMs; }
  async register({ tenant, name, capabilities = [], metadata = {} }) {
    const worker = { id: randomId("wrk"), tenant, name, capabilities: [...new Set(capabilities)].sort(), metadata, status: "ready", registeredAt: new Date().toISOString(), heartbeatAt: new Date().toISOString() };
    await this.store.update(value => { value.workers.push(worker); return worker; });
    await this.bus.publish({ tenant, type: "worker.registered", actor: worker.id, payload: worker }); return worker;
  }
  async heartbeat(id, tenant) {
    return this.store.update(value => { const worker = value.workers.find(item => item.id === id && item.tenant === tenant); if (!worker) throw Object.assign(new Error("worker not found"), { statusCode: 404 }); worker.heartbeatAt = new Date().toISOString(); worker.status = "ready"; return worker; });
  }
  async enqueue({ tenant, capability, input, workflowId = null, stepId = null }) {
    const task = { id: randomId("tsk"), tenant, capability, input, workflowId, stepId, status: "queued", createdAt: new Date().toISOString(), attempts: 0, lease: null, result: null };
    await this.store.update(value => { value.tasks.push(task); return task; });
    await this.bus.publish({ tenant, type: "task.queued", payload: task }); return task;
  }
  async lease(workerId, tenant) {
    const now = Date.now();
    return this.store.update(value => {
      const worker = value.workers.find(item => item.id === workerId && item.tenant === tenant);
      if (!worker) throw Object.assign(new Error("worker not found"), { statusCode: 404 });
      const task = value.tasks.find(item => item.tenant === tenant && item.status === "queued" && worker.capabilities.includes(item.capability));
      if (!task) return null;
      task.status = "leased"; task.attempts += 1; task.lease = { workerId, leasedAt: new Date(now).toISOString(), expiresAt: new Date(now + this.leaseMs).toISOString() }; worker.status = "busy"; return task;
    });
  }
  async complete(workerId, taskId, tenant, { ok, output = null, error = null }) {
    const task = await this.store.update(value => {
      const task = value.tasks.find(item => item.id === taskId && item.tenant === tenant);
      if (!task || task.lease?.workerId !== workerId) throw Object.assign(new Error("leased task not found"), { statusCode: 404 });
      task.status = ok ? "completed" : "failed"; task.completedAt = new Date().toISOString(); task.result = { ok, output, error };
      const worker = value.workers.find(item => item.id === workerId); if (worker) worker.status = "ready"; return task;
    });
    await this.bus.publish({ tenant, type: `task.${task.status}`, actor: workerId, payload: task }); return task;
  }
  async reap() {
    const now = Date.now();
    return this.store.update(value => {
      for (const worker of value.workers) if (now - Date.parse(worker.heartbeatAt) > this.staleMs) worker.status = "stale";
      for (const task of value.tasks) if (task.status === "leased" && Date.parse(task.lease.expiresAt) <= now) { task.status = "queued"; task.lease = null; }
      return { workers: value.workers.length, tasks: value.tasks.length };
    });
  }
  async list(tenant) { const value = await this.store.read(); return { workers: value.workers.filter(x => x.tenant === tenant), tasks: value.tasks.filter(x => x.tenant === tenant) }; }
}
