import fs from "node:fs/promises";

export class PolicyEngine {
  constructor(file) { this.file = file; this.policy = null; }
  async load() { this.policy = JSON.parse(await fs.readFile(this.file, "utf8")); return this.policy; }
  async evaluate({ capability, environment = "development", risk = "low", approvals = 0, actorScopes = [] }) {
    if (!this.policy) await this.load();
    const rule = this.policy.capabilities[capability];
    if (!rule) return { allowed: false, reason: "capability is not registered", requiredApprovals: 0 };
    if (rule.deniedEnvironments?.includes(environment)) return { allowed: false, reason: `capability denied in ${environment}`, requiredApprovals: 0 };
    const requiredScope = rule.scope || capability;
    if (!actorScopes.includes(requiredScope) && !actorScopes.includes("fabric.admin")) return { allowed: false, reason: `scope ${requiredScope} required`, requiredApprovals: 0 };
    const requiredApprovals = Math.max(rule.approvals?.[environment] || 0, rule.riskApprovals?.[risk] || 0);
    return { allowed: approvals >= requiredApprovals, reason: approvals >= requiredApprovals ? "allowed" : "approval threshold not met", requiredApprovals };
  }
}
