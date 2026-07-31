import fs from "node:fs/promises";

const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };

export class CapabilityPolicyEngine {
  constructor({ policyFile }) {
    this.policyFile = policyFile;
    this.policy = null;
  }

  async load() {
    this.policy = JSON.parse(await fs.readFile(this.policyFile, "utf8"));
    return this.policy;
  }

  async evaluate({ subject, capability, environment = "development", risk = "low", approved = false }) {
    if (!this.policy) await this.load();
    const subjectRules = this.policy.subjects[subject] || this.policy.subjects.default;
    const denied = new Set(subjectRules.deny || []);
    const allowed = new Set(subjectRules.allow || []);
    let decision = "deny";
    let reason = "capability not granted";

    if (denied.has(capability) || denied.has("*")) {
      reason = "explicitly denied";
    } else if (allowed.has(capability) || allowed.has("*")) {
      decision = "allow";
      reason = "capability granted";
    }

    const threshold = this.policy.environments[environment]?.approvalRequiredAt || "high";
    if (decision === "allow" && riskOrder[risk] >= riskOrder[threshold] && !approved) {
      decision = "require-approval";
      reason = `${risk} risk requires approval in ${environment}`;
    }

    return { decision, reason, subject, capability, environment, risk };
  }
}
