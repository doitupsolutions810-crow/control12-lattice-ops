import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.mjs";
import { MessageBus } from "./bus/message-bus.mjs";
import { CapabilityPolicyEngine } from "./policy/capability-engine.mjs";
import { ComponentRegistry } from "./registry/component-registry.mjs";
import { KnowledgeGraph } from "./graph/knowledge-graph.mjs";
import { AgentSDK } from "./agents/agent-sdk.mjs";
import { CodingAgent } from "./agents/coding-agent.mjs";
import { ArtifactBuilder } from "./artifacts/artifact-builder.mjs";
import { DeploymentCoordinator } from "./deployment/deployment-coordinator.mjs";
import { WorkflowScheduler } from "./scheduler/workflow-scheduler.mjs";
import { RuntimeSupervisor } from "./runtime/runtime-supervisor.mjs";
import { appendJsonLine } from "./lib/json-store.mjs";
import { readJson, requireAuth, sendJson } from "./http/router.mjs";
import { ResonantBridge } from "./audio/resonant-bridge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(here, "../dashboard");
const policyFile = process.env.CONTROL12_POLICY_FILE || path.resolve(here, "../policies/default.json");
const codeWorkspace = process.env.CONTROL12_CODE_WORKSPACE || path.join(config.root, "workspace");

const bus = new MessageBus({ eventFile: config.eventFile });
const policy = new CapabilityPolicyEngine({ policyFile });
const registry = new ComponentRegistry(config.registryFile);
const graph = new KnowledgeGraph(config.graphFile);

const resonant = new ResonantBridge({ label: "control12-platform" });

const strictAllowlist = process.env.CONTROL12_CODE_STRICT_ALLOWLIST === "1";
const coding = new CodingAgent({
  workspaceRoot: codeWorkspace,
  localAgentUrl: config.localAgentUrl,
  bus,
  policyOptions: {
    strictAllowlist,
    maxWriteBytes: Number(process.env.CONTROL12_CODE_MAX_WRITE_BYTES || 512_000),
    maxCommandChars: Number(process.env.CONTROL12_CODE_MAX_COMMAND_CHARS || 2_000),
    maxConcurrent: Number(process.env.CONTROL12_CODE_MAX_CONCURRENT || 2),
    rateLimitMax: Number(process.env.CONTROL12_CODE_RATE_LIMIT || 20),
    maxTimeoutMs: Number(process.env.CONTROL12_CODE_MAX_TIMEOUT_MS || 120_000)
  }
});

const agents = new AgentSDK({ baseUrl: config.localAgentUrl, bus, resonant, coding });
const artifacts = new ArtifactBuilder({ artifactDir: config.artifactDir, bus });
const deployments = new DeploymentCoordinator({ policy, bus, executor: config.deployExecutor });
const scheduler = new WorkflowScheduler({
  file: config.workflowFile,
  bus,
  agents,
  artifacts,
  deployments,
  maxConcurrent: config.maxConcurrentWorkflows
});
const supervisor = new RuntimeSupervisor({ config, bus, agents, registry, scheduler });

await policy.load();
await fs.mkdir(codeWorkspace, { recursive: true });

for (const [id, purpose] of Object.entries(agents.list())) {
  await registry.register({ id: `agent.${id}`, version: config.version, kind: "agent", capabilities: ["agent.invoke"], purpose });
  await graph.upsertNode({ id: `agent.${id}`, type: "agent", purpose });
}

await registry.register({
  id: "audio.living-intermediate",
  version: config.version,
  kind: "audio",
  capabilities: ["audio.tick", "audio.spectrum", "audio.silence", "audio.jacobian"],
  purpose: "Additive synthesis organ of attention; belief Jacobian-driven partials for chatbot and agent coherence."
});
await graph.upsertNode({ id: "audio.living-intermediate", type: "audio", purpose: "living intermediate" });

await registry.register({
  id: "code.workspace",
  version: config.version,
  kind: "code",
  capabilities: ["code.write", "code.edit", "code.execute"],
  purpose: "Sandboxed coding agent with policy-bounded terminal execution via local-agent."
});
await graph.upsertNode({ id: "code.workspace", type: "code", purpose: "coding agent workspace" });

bus.subscribe("*", event => appendJsonLine(config.auditFile, { type: "event", event }));

async function serveDashboard(res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safe = path.normalize(requested).replace(/^\.\.(\/|\\|$)/, "");
  const file = path.join(dashboardDir, safe);
  if (!file.startsWith(dashboardDir)) return false;
  try {
    const body = await fs.readFile(file);
    const ext = path.extname(file);
    const type = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : "text/javascript";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${config.host}:${config.port}`}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, await supervisor.health());
    if (req.method === "GET" && url.pathname === "/api/v1/components") return sendJson(res, 200, await registry.list());
    if (req.method === "GET" && url.pathname === "/api/v1/agents") return sendJson(res, 200, agents.list());
    if (req.method === "GET" && url.pathname === "/api/v1/workflows") return sendJson(res, 200, await scheduler.list());
    if (req.method === "GET" && url.pathname === "/api/v1/graph") return sendJson(res, 200, await graph.snapshot());
    if (req.method === "GET" && url.pathname === "/api/v1/code/policy") {
      return sendJson(res, 200, coding.getPolicySnapshot());
    }

    if (req.method === "GET" && url.pathname === "/api/v1/audio/state") {
      return sendJson(res, 200, resonant.getState());
    }
    if (req.method === "GET" && url.pathname === "/api/v1/audio/spectrum") {
      return sendJson(res, 200, resonant.getSpectrum());
    }
    if (req.method === "GET" && url.pathname === "/api/v1/audio/prompt") {
      return sendJson(res, 200, { fragment: resonant.toPromptFragment() });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/audio/history") {
      const limit = Number(url.searchParams.get("limit") || 8);
      return sendJson(res, 200, resonant.getHistory(limit));
    }

    if (req.method === "POST") requireAuth(req, config.apiToken);

    if (req.method === "POST" && url.pathname === "/api/v1/audio/tick") {
      const body = await readJson(req, config.maxBodyBytes);
      const belief = body.belief != null ? Number(body.belief) : 0.5;
      const other = body.otherBelief != null ? Number(body.otherBelief) : null;
      return sendJson(res, 200, resonant.tick(belief, other));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/audio/silence") {
      return sendJson(res, 200, resonant.silence());
    }

    if (req.method === "POST" && url.pathname === "/api/v1/code/write") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.writeFile(body.path, body.content ?? ""));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/code/edit") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.editFile(body.path, body.oldString, body.newString, {
        replaceAll: Boolean(body.replaceAll)
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/code/read") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.readFile(body.path));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/code/list") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.listFiles(body.path || "."));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/code/produce") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.produceAndRun({
        path: body.path,
        content: body.content ?? "",
        command: body.command ?? null
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/terminal") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await coding.execute(body.command, {
        cwd: body.cwd ?? null,
        timeoutMs: body.timeoutMs
      }));
    }

    if (req.method === "POST" && url.pathname === "/api/v1/components") {
      const component = await registry.register(await readJson(req, config.maxBodyBytes));
      await graph.upsertNode({ id: component.id, type: component.kind, digest: component.digest });
      return sendJson(res, 201, component);
    }
    if (req.method === "POST" && url.pathname === "/api/v1/workflows") {
      const workflow = await scheduler.submit(await readJson(req, config.maxBodyBytes));
      return sendJson(res, 202, workflow);
    }
    if (req.method === "POST" && /^\/api\/v1\/workflows\/[^/]+\/run$/.test(url.pathname)) {
      const id = url.pathname.split("/")[4];
      return sendJson(res, 200, await scheduler.run(id));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/artifacts") {
      return sendJson(res, 201, await artifacts.build(await readJson(req, config.maxBodyBytes)));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/deployments/plan") {
      return sendJson(res, 200, await deployments.plan(await readJson(req, config.maxBodyBytes)));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/policy/evaluate") {
      return sendJson(res, 200, await policy.evaluate(await readJson(req, config.maxBodyBytes)));
    }

    if (req.method === "GET" && await serveDashboard(res, url.pathname)) return;
    return sendJson(res, 404, { error: "not found" });
  } catch (error) {
    const status = error.statusCode || 500;
    await appendJsonLine(config.auditFile, {
      type: "error",
      observedAt: new Date().toISOString(),
      path: url.pathname,
      message: error.message,
      code: error.code || null
    });
    return sendJson(res, status, { error: error.message, code: error.code || undefined });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`CONTROL12 Sovereign Platform v${config.version} listening on http://${config.host}:${config.port}`);
  console.log(`Code workspace: ${codeWorkspace}`);
  console.log(`Code policy: ${JSON.stringify(coding.getPolicySnapshot())}`);
});
