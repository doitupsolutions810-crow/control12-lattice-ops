import path from "node:path";
import { AtomicJsonStore } from "../lib/atomic-store.mjs";
import { randomId } from "../lib/canonical.mjs";

export class ApprovalStore {
  constructor(stateDir, bus) { this.store = new AtomicJsonStore(path.join(stateDir, "approvals.json"), { approvals: [] }); this.bus = bus; }
  async create({ tenant, requester, capability, resource, required = 1, ttlSeconds = 3600 }) {
    const approval = { id: randomId("apr"), tenant, requester, capability, resource, required, decisions: [], status: "pending", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
    await this.store.update(value => { value.approvals.push(approval); return approval; });
    await this.bus.publish({ tenant, type: "approval.created", actor: requester, payload: approval });
    return approval;
  }
  async decide(id, { tenant, actor, decision, reason = "" }) {
    if (!["approve","reject"].includes(decision)) throw Object.assign(new Error("decision must be approve or reject"), { statusCode: 400 });
    const result = await this.store.update(value => {
      const approval = value.approvals.find(item => item.id === id && item.tenant === tenant);
      if (!approval) throw Object.assign(new Error("approval not found"), { statusCode: 404 });
      if (approval.requester === actor) throw Object.assign(new Error("requester cannot approve their own request"), { statusCode: 409 });
      if (new Date(approval.expiresAt) <= new Date()) approval.status = "expired";
      if (approval.status !== "pending") throw Object.assign(new Error(`approval is ${approval.status}`), { statusCode: 409 });
      if (approval.decisions.some(item => item.actor === actor)) throw Object.assign(new Error("actor already decided"), { statusCode: 409 });
      approval.decisions.push({ actor, decision, reason, observedAt: new Date().toISOString() });
      if (decision === "reject") approval.status = "rejected";
      else if (approval.decisions.filter(item => item.decision === "approve").length >= approval.required) approval.status = "approved";
      return approval;
    });
    await this.bus.publish({ tenant, type: "approval.decided", actor, payload: result });
    return result;
  }
  async get(id, tenant) { const value = await this.store.read(); return value.approvals.find(item => item.id === id && item.tenant === tenant) || null; }
  async list(tenant) { return (await this.store.read()).approvals.filter(item => item.tenant === tenant); }
}
