export class RuntimeSupervisor {
  constructor({ config, bus, agents, registry, scheduler }) {
    this.config = config;
    this.bus = bus;
    this.agents = agents;
    this.registry = registry;
    this.scheduler = scheduler;
    this.startedAt = new Date().toISOString();
  }

  async probe(url, timeoutMs = 5000) {
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      return { ok: response.ok, status: response.status, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, error: error.message, latencyMs: Date.now() - started };
    }
  }

  async health() {
    const localAgent = await this.probe(`${this.config.localAgentUrl}/health`);
    return {
      status: localAgent.ok ? "ok" : "degraded",
      version: this.config.version,
      startedAt: this.startedAt,
      observedAt: new Date().toISOString(),
      dependencies: { localAgent },
      components: (await this.registry.list()).length,
      workflows: (await this.scheduler.list()).length,
      agents: Object.keys(this.agents.list())
    };
  }
}
