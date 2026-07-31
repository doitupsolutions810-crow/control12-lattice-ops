export class PluginExecutor {
  constructor({ registry, policy, approvals, bus, environment }) {
    this.registry = registry;
    this.policy = policy;
    this.approvals = approvals;
    this.bus = bus;
    this.environment = environment;
  }

  async invoke({ tenant, actor, actorScopes, pluginId, capability, method = "GET", path = "/", body = null, approvalId = null, risk = "medium" }) {
    const plugin = this.registry.get(pluginId);
    if (!plugin) throw Object.assign(new Error("plugin not found"), { statusCode: 404 });
    if (!plugin.capabilities.includes(capability)) throw Object.assign(new Error("plugin capability not declared"), { statusCode: 403 });
    const normalizedMethod = String(method).toUpperCase();
    if (!(plugin.allowedMethods || ["GET"]).includes(normalizedMethod)) throw Object.assign(new Error("HTTP method not allowed by plugin manifest"), { statusCode: 403 });
    if (!String(path).startsWith("/") || String(path).includes("..")) throw Object.assign(new Error("invalid plugin path"), { statusCode: 400 });

    const approval = approvalId ? await this.approvals.get(approvalId, tenant) : null;
    const approvals = approval?.status === "approved" ? approval.required : 0;
    const policyDecision = await this.policy.evaluate({ capability: "plugin.invoke", environment: this.environment, risk, approvals, actorScopes });
    if (!policyDecision.allowed) throw Object.assign(new Error(policyDecision.reason), { statusCode: 403, policyDecision });

    const url = new URL(path, plugin.baseUrl);
    if (!(plugin.allowedHosts || []).includes(url.hostname)) throw Object.assign(new Error("plugin destination host is not allowlisted"), { statusCode: 403 });
    if (url.protocol !== "https:") throw Object.assign(new Error("plugin destinations must use HTTPS"), { statusCode: 403 });

    const secret = process.env[plugin.auth?.secretEnv || ""];
    if (!secret) throw Object.assign(new Error(`plugin credential is not configured: ${plugin.auth?.secretEnv || "unknown"}`), { statusCode: 503 });
    const headers = { accept: "application/json", "user-agent": "control12-sovereign-fabric/2.0.0" };
    if (["bearer", "oauth"].includes(plugin.auth?.type)) headers.authorization = `Bearer ${secret}`;
    if (body !== null) headers["content-type"] = "application/json";

    await this.bus.publish({ tenant, type: "plugin.invocation.started", actor, payload: { pluginId, capability, method: normalizedMethod, path, approvalId } });
    const response = await fetch(url, {
      method: normalizedMethod,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(Number(plugin.timeoutMs || 120000))
    });
    const text = (await response.text()).slice(0, Number(plugin.maxResponseBytes || 1_000_000));
    let output;
    try { output = JSON.parse(text); } catch { output = { text }; }
    const receipt = { pluginId, capability, method: normalizedMethod, path, status: response.status, ok: response.ok, output };
    await this.bus.publish({ tenant, type: "plugin.invocation.completed", actor, payload: { ...receipt, output: undefined } });
    if (!response.ok) throw Object.assign(new Error(`plugin HTTP ${response.status}`), { statusCode: 502, receipt });
    return receipt;
  }
}
