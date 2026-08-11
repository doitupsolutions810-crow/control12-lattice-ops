import { randomId } from "../lib/canonical.mjs";

export class DeploymentCoordinator {
  constructor({ policy, approvals, bus, environment }) { this.policy = policy; this.approvals = approvals; this.bus = bus; this.environment = environment; }
  async plan({ tenant, actor, actorScopes, image, target, strategy = "canary", risk = "high", approvalId = null }) {
    if (!/^.+@sha256:[a-f0-9]{64}$/.test(image || "")) throw Object.assign(new Error("deployment image must be digest-pinned"), { statusCode: 400 });
    const approval = approvalId ? await this.approvals.get(approvalId, tenant) : null;
    const approvals = approval?.status === "approved" ? approval.required : 0;
    const decision = await this.policy.evaluate({ capability: "deployment.write", environment: this.environment, risk, approvals, actorScopes });
    const plan = { id: randomId("dep"), tenant, image, target, strategy, risk, approvalId, decision, stages: strategy === "canary" ? [{ percent: 5, holdSeconds: 300 }, { percent: 25, holdSeconds: 600 }, { percent: 100, holdSeconds: 0 }] : [{ percent: 100, holdSeconds: 0 }], createdAt: new Date().toISOString() };
    await this.bus.publish({ tenant, type: "deployment.planned", actor, payload: plan }); return plan;
  }
}
