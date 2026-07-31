const CORE_AGENTS = Object.freeze({
  planner: "Decompose goals, constraints, dependencies, and evidence requirements.",
  engineer: "Implement and review code, interfaces, tests, and runtime behavior.",
  artifact: "Build and verify artifacts, manifests, hashes, and provenance.",
  operations: "Evaluate service health, capacity, deployment, and recovery state.",
  verifier: "Reject unsupported claims and enforce evidence-backed promotion gates.",
  resonant: "Hold and advance the living intermediate (belief, tension, additive spectrum) for chatbot and agent coherence."
});

export class AgentSDK {
  constructor({ baseUrl, bus, resonant = null }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.bus = bus;
    this.resonant = resonant;
  }

  list() {
    return CORE_AGENTS;
  }

  async invoke(role, message, { includeEvidence = true, timeoutMs = 300000, belief = null } = {}) {
    if (!CORE_AGENTS[role]) throw new Error(`unknown core agent: ${role}`);

    // Resonant path stays local – no network hop required
    if (role === "resonant" && this.resonant) {
      await this.bus.publish("agent.started", { role, message });
      const b = belief != null ? belief : 0.5;
      const snapshot = this.resonant.tick(b);
      const result = {
        status: "ok",
        role: "resonant",
        message,
        snapshot,
        promptFragment: this.resonant.toPromptFragment()
      };
      await this.bus.publish("agent.completed", { role, status: result.status });
      return result;
    }

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
