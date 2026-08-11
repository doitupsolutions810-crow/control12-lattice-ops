const CORE_AGENTS = Object.freeze({
  planner: "Decompose goals, constraints, dependencies, and evidence requirements.",
  engineer: "Implement and review code, interfaces, tests, and runtime behavior.",
  artifact: "Build and verify artifacts, manifests, hashes, and provenance.",
  operations: "Evaluate service health, capacity, deployment, and recovery state.",
  verifier: "Reject unsupported claims and enforce evidence-backed promotion gates.",
  resonant: "Hold and advance the living intermediate (belief, tension, additive spectrum) for chatbot and agent coherence.",
  coder: "Produce, edit, and write code in the workspace and execute commands via bounded local-agent terminal."
});

export class AgentSDK {
  constructor({ baseUrl, bus, resonant = null, coding = null }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.bus = bus;
    this.resonant = resonant;
    this.coding = coding;
  }

  list() {
    return CORE_AGENTS;
  }

  async invoke(role, message, {
    includeEvidence = true,
    timeoutMs = 300000,
    belief = null,
    code = null
  } = {}) {
    if (!CORE_AGENTS[role]) throw new Error(`unknown core agent: ${role}`);

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

    if (role === "coder" && this.coding) {
      await this.bus.publish("agent.started", { role, message });
      let result;
      if (code && code.action === "write") {
        result = await this.coding.writeFile(code.path, code.content ?? "");
      } else if (code && code.action === "edit") {
        result = await this.coding.editFile(code.path, code.oldString, code.newString, {
          replaceAll: Boolean(code.replaceAll)
        });
      } else if (code && code.action === "execute") {
        result = await this.coding.execute(code.command, { cwd: code.cwd ?? null });
      } else if (code && code.action === "produce") {
        result = await this.coding.produceAndRun({
          path: code.path,
          content: code.content ?? "",
          command: code.command ?? null
        });
      } else {
        result = {
          status: "ok",
          role: "coder",
          message,
          hint: "Pass code: { action: 'write'|'edit'|'execute'|'produce', ... }"
        };
      }
      await this.bus.publish("agent.completed", { role, status: "ok" });
      return { status: "ok", role: "coder", message, result };
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
