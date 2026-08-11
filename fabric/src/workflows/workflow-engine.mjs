import path from "node:path";
import { AtomicJsonStore } from "../lib/atomic-store.mjs";
import { randomId } from "../lib/canonical.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class WorkflowEngine {
  constructor({ stateDir, bus, approvals, artifacts, workers, deployments, pluginExecutor = null, maxConcurrent = 4, localAgentUrl }) {
    this.store = new AtomicJsonStore(path.join(stateDir, "workflows.json"), { workflows: [] }); this.bus = bus; this.approvals = approvals; this.artifacts = artifacts; this.workers = workers; this.deployments = deployments; this.pluginExecutor = pluginExecutor; this.maxConcurrent = maxConcurrent; this.localAgentUrl = localAgentUrl; this.running = new Set();
  }
  validate(input) {
    if (!input.name || !Array.isArray(input.steps) || !input.steps.length) throw Object.assign(new Error("workflow name and steps are required"), { statusCode: 400 });
    const ids = new Set(); for (const step of input.steps) { if (!step.id || ids.has(step.id)) throw Object.assign(new Error("step ids must be unique"), { statusCode: 400 }); ids.add(step.id); }
    for (const step of input.steps) for (const dependency of step.dependsOn || []) if (!ids.has(dependency)) throw Object.assign(new Error(`unknown dependency ${dependency}`), { statusCode: 400 });
  }
  async submit({ tenant, actor, name, steps, metadata = {} }) {
    this.validate({ name, steps }); const workflow = { id: randomId("wf"), tenant, actor, name, metadata, status: "queued", cancelRequested: false, createdAt: new Date().toISOString(), startedAt: null, completedAt: null, steps: steps.map(step => ({ retries: 0, timeoutMs: 120000, ...step, status: "pending", attempts: 0, result: null, error: null })) };
    await this.store.update(value => { value.workflows.push(workflow); return workflow; }); await this.bus.publish({ tenant, type: "workflow.submitted", actor, payload: { id: workflow.id, name } }); return workflow;
  }
  async get(id, tenant) { return (await this.store.read()).workflows.find(x => x.id === id && x.tenant === tenant) || null; }
  async list(tenant) { return (await this.store.read()).workflows.filter(x => x.tenant === tenant); }
  async cancel(id, tenant, actor) { const workflow = await this.store.update(value => { const wf = value.workflows.find(x => x.id === id && x.tenant === tenant); if (!wf) throw Object.assign(new Error("workflow not found"), { statusCode: 404 }); wf.cancelRequested = true; return wf; }); await this.bus.publish({ tenant, type: "workflow.cancel.requested", actor, payload: { id } }); return workflow; }
  async executeStep(workflow, step, actorScopes) {
    switch (step.type) {
      case "event": return this.bus.publish({ tenant: workflow.tenant, type: step.eventType || "workflow.event", actor: workflow.actor, payload: step.input || {} });
      case "artifact": return this.artifacts.put({ tenant: workflow.tenant, name: step.name || step.id, mediaType: step.mediaType || "application/json", content: step.input || {}, provenance: { workflowId: workflow.id, stepId: step.id } });
      case "approval": { const approval = await this.approvals.get(step.approvalId, workflow.tenant); if (!approval || approval.status !== "approved") throw Object.assign(new Error("approval gate not satisfied"), { retryable: true }); return approval; }
      case "worker": return this.workers.enqueue({ tenant: workflow.tenant, capability: step.capability, input: step.input || {}, workflowId: workflow.id, stepId: step.id });
      case "deployment": return this.deployments.plan({ tenant: workflow.tenant, actor: workflow.actor, actorScopes, ...step.input });
      case "plugin": { if (!this.pluginExecutor) throw new Error("plugin executor unavailable"); return this.pluginExecutor.invoke({ tenant: workflow.tenant, actor: workflow.actor, actorScopes, ...step.input }); }
      case "agent": {
        const response = await fetch(`${this.localAgentUrl}/api/agents/${encodeURIComponent(step.role || "verifier")}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: step.message, includeEvidence: step.includeEvidence !== false }), signal: AbortSignal.timeout(step.timeoutMs) });
        const text = await response.text(); if (!response.ok) throw new Error(`local agent HTTP ${response.status}: ${text.slice(0,500)}`); return JSON.parse(text);
      }
      default: throw new Error(`unsupported step type: ${step.type}`);
    }
  }
  async run(id, tenant, actorScopes = []) {
    if (this.running.size >= this.maxConcurrent) throw Object.assign(new Error("workflow concurrency limit reached"), { statusCode: 429 });
    const workflow = await this.get(id, tenant); if (!workflow) throw Object.assign(new Error("workflow not found"), { statusCode: 404 }); if (this.running.has(id)) throw Object.assign(new Error("workflow already running"), { statusCode: 409 });
    this.running.add(id); workflow.status = "running"; workflow.startedAt = new Date().toISOString(); await this.persist(workflow); await this.bus.publish({ tenant, type: "workflow.started", actor: workflow.actor, payload: { id } });
    try {
      while (workflow.steps.some(step => ["pending","retrying"].includes(step.status))) {
        const stored = await this.get(id, tenant); if (stored.cancelRequested) { workflow.cancelRequested = true; workflow.status = "cancelled"; break; }
        const ready = workflow.steps.filter(step => ["pending","retrying"].includes(step.status) && (step.dependsOn || []).every(dep => workflow.steps.find(x => x.id === dep)?.status === "completed"));
        if (!ready.length) throw new Error("workflow dependency deadlock or failed prerequisite");
        for (const step of ready) {
          step.status = "running"; step.attempts += 1; step.startedAt = new Date().toISOString(); await this.persist(workflow);
          try { step.result = await this.executeStep(workflow, step, actorScopes); step.status = "completed"; step.completedAt = new Date().toISOString(); await this.bus.publish({ tenant, type: "workflow.step.completed", actor: workflow.actor, payload: { workflowId: id, stepId: step.id } }); }
          catch (error) { step.error = error.message; if (step.attempts <= step.retries && error.retryable !== false) { step.status = "retrying"; await sleep(Math.min(1000 * 2 ** (step.attempts - 1), 10000)); } else { step.status = "failed"; workflow.status = "failed"; throw error; } }
          await this.persist(workflow);
        }
      }
      if (workflow.status === "running") workflow.status = "completed";
    } catch (error) { workflow.status = workflow.status === "cancelled" ? "cancelled" : "failed"; workflow.error = error.message; }
    finally { workflow.completedAt = new Date().toISOString(); await this.persist(workflow); await this.bus.publish({ tenant, type: `workflow.${workflow.status}`, actor: workflow.actor, payload: { id, error: workflow.error || null } }); this.running.delete(id); }
    return workflow;
  }
  async persist(workflow) { await this.store.update(value => { const i = value.workflows.findIndex(x => x.id === workflow.id); value.workflows[i] = workflow; return workflow; }); }
}
