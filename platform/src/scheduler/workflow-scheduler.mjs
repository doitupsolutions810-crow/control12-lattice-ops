import { JsonStore } from "../lib/json-store.mjs";
import { randomId } from "../lib/hash.mjs";

export class WorkflowScheduler {
  constructor({ file, bus, agents, artifacts, deployments, maxConcurrent = 4 }) {
    this.store = new JsonStore(file, { schema: "control12.workflows/v1", workflows: {} });
    this.bus = bus;
    this.agents = agents;
    this.artifacts = artifacts;
    this.deployments = deployments;
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
  }

  async submit(definition) {
    if (!definition.name || !Array.isArray(definition.steps) || definition.steps.length === 0) {
      throw new Error("workflow name and non-empty steps are required");
    }
    const workflow = {
      id: randomId("workflow"),
      name: definition.name,
      status: "queued",
      createdAt: new Date().toISOString(),
      steps: definition.steps,
      context: definition.context || {},
      results: []
    };
    await this.store.update(state => {
      state.workflows[workflow.id] = workflow;
      return state;
    });
    await this.bus.publish("workflow.queued", { id: workflow.id, name: workflow.name });
    return workflow;
  }

  async run(id) {
    if (this.running >= this.maxConcurrent) throw new Error("workflow concurrency limit reached");
    const state = await this.store.read();
    const workflow = state.workflows[id];
    if (!workflow) throw new Error("workflow not found");
    this.running += 1;
    workflow.status = "running";
    workflow.startedAt = new Date().toISOString();
    await this.store.write(state);
    await this.bus.publish("workflow.started", { id });

    try {
      for (const [index, step] of workflow.steps.entries()) {
        const result = await this.runStep(step, workflow.context);
        workflow.results.push({ index, type: step.type, result, completedAt: new Date().toISOString() });
        await this.store.write(state);
      }
      workflow.status = "completed";
      workflow.completedAt = new Date().toISOString();
      await this.bus.publish("workflow.completed", { id });
      return workflow;
    } catch (error) {
      workflow.status = "failed";
      workflow.error = error.message;
      workflow.completedAt = new Date().toISOString();
      await this.bus.publish("workflow.failed", { id, error: error.message });
      throw error;
    } finally {
      await this.store.write(state);
      this.running -= 1;
    }
  }

  async runStep(step, context) {
    switch (step.type) {
      case "agent":
        return this.agents.invoke(step.role, step.message, step.options);
      case "artifact":
        return this.artifacts.build({ ...step.input, provenance: { workflowContext: context } });
      case "deployment-plan":
        return this.deployments.plan(step.input);
      case "emit":
        return this.bus.publish(step.topic, step.payload || {});
      default:
        throw new Error(`unsupported workflow step type: ${step.type}`);
    }
  }

  async get(id) {
    return (await this.store.read()).workflows[id] || null;
  }

  async list() {
    return Object.values((await this.store.read()).workflows);
  }
}
