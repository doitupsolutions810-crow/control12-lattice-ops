const CORE_AGENTS = Object.freeze({
  planner: "Decompose goals, constraints, dependencies, and evidence requirements.",
  engineer: "Implement and review code, interfaces, tests, and runtime behavior.",
  artifact: "Build and verify artifacts, manifests, hashes, and provenance.",
  operations: "Evaluate service health, capacity, deployment, and recovery state.",
  verifier: "Reject unsupported claims and enforce evidence-backed promotion gates."
});

export class AgentSDK {
  constructor({ baseUrl, bus }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.bus = bus;
  }

  list() {
    return CORE_AGENTS;
  }

  async invoke(role, message, { includeEvidence = true, timeoutMs = 300000 } = {}) {
    if (!CORE_AGENTS[role]) throw new Error(`unknown core agent: ${role}`);
    await this.bus.publish("agent.started", { role, message });
    const response = await fetch(`${this.baseUrl}/api/agents/${encodeURIComponent(role)}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, includeEvidence }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`agent ${role} failed: HTTP ${response.status}: ${text.slice(0, 500)}`);
    const result = JSON.parse(text);
    await this.bus.publish("agent.completed", { role, status: result.status });
    return result;
  }
}
