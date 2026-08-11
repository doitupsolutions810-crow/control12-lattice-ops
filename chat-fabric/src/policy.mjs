const ROLE_ALLOW = Object.freeze({
  user: new Set(["chat.send", "workspace.read", "workspace.write", "memory.read", "memory.write", "research.request", "artifact.request"]),
  coding: new Set(["workspace.read", "workspace.write", "memory.read", "artifact.request", "tool.execute:workspace"]),
  artifact: new Set(["workspace.read", "artifact.request", "artifact.publish:staging"]),
  operator: new Set(["workspace.read", "memory.read", "research.request", "cluster.read", "deployment.propose"]),
  verifier: new Set(["workspace.read", "memory.read", "evidence.read", "artifact.verify"]),
  supervisor: new Set(["chat.send", "workspace.read", "workspace.write", "memory.read", "memory.write", "research.request", "artifact.request", "agent.delegate", "policy.request"])
});

const HARD_DENY = new Set([
  "secret.read",
  "policy.modify",
  "production.execute",
  "rbac.modify",
  "admission.disable",
  "network.widen"
]);

export function assertCapability(role, capability) {
  if (HARD_DENY.has(capability)) throw new Error(`capability denied: ${capability}`);
  const allow = ROLE_ALLOW[role];
  if (!allow || !allow.has(capability)) throw new Error(`capability not granted to ${role}: ${capability}`);
}

export function capabilitySnapshot() {
  return {
    schema: "control12.chat-capabilities/v1",
    roles: Object.fromEntries(Object.entries(ROLE_ALLOW).map(([k, v]) => [k, [...v].sort()])),
    hardDeny: [...HARD_DENY].sort(),
    invariants: {
      workspaceExecutionIsConfined: true,
      productionExecutionRequiresSeparateV5PolicyAllow: true,
      secretsAreNeverReturnedToModelContext: true,
      externalResearchIsExplicitlyRequested: true
    }
  };
}
