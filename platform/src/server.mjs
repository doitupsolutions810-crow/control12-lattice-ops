import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.mjs";
import { MessageBus } from "./bus/message-bus.mjs";
import { CapabilityPolicyEngine } from "./policy/capability-engine.mjs";
import { ComponentRegistry } from "./registry/component-registry.mjs";
import { KnowledgeGraph } from "./graph/knowledge-graph.mjs";
import { BeliefGraph } from "./graph/belief-graph.mjs";
import { seedBeliefField } from "./graph/seed-belief-field.mjs";
import { AgentSDK } from "./agents/agent-sdk.mjs";
import { CodingAgent } from "./agents/coding-agent.mjs";
import { CodingQuorum } from "./agents/coding-quorum.mjs";
import { ArtifactBuilder } from "./artifacts/artifact-builder.mjs";
import { DeploymentCoordinator } from "./deployment/deployment-coordinator.mjs";
import { WorkflowScheduler } from "./scheduler/workflow-scheduler.mjs";
import { RuntimeSupervisor } from "./runtime/runtime-supervisor.mjs";
import { appendJsonLine } from "./lib/json-store.mjs";
import { readJson, requireAuth, requireAuthUnlessChatOpen, sendJson, sendOptions } from "./http/router.mjs";
import { AccessLog } from "./http/access-log.mjs";
import { createAppServer, installTlsReloadSignal } from "./http/create-server.mjs";
import { resolveTlsPaths } from "./http/tls-material.mjs";
import { buildSecurityStatus } from "./security/status.mjs";
import { ResonantBridge } from "./audio/resonant-bridge.mjs";
import { ChatWire } from "./bridge/chat-wire.mjs";
import { codingQuorumLocal, codingQuorumFull } from "./workflows/templates.mjs";
import { bootV2, enhanceCodingQuorumOptions, handleV2Routes } from "./server-v2-boot.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(here, "../dashboard");
const policyFile = process.env.CONTROL12_POLICY_FILE || path.resolve(here, "../policies/default.json");
const codeWorkspace = process.env.CONTROL12_CODE_WORKSPACE || path.join(config.root, "workspace");
const requireQuorum = process.env.CONTROL12_CODE_REQUIRE_QUORUM === "1";
const chatOpen = process.env.CONTROL12_CHAT_OPEN === "1";
const accessLogPath = process.env.CONTROL12_ACCESS_LOG || path.join(config.root, "access.jsonl");
const accessLog = new AccessLog(accessLogPath);

const bus = new MessageBus({ eventFile: config.eventFile });
const policy = new CapabilityPolicyEngine({ policyFile });
const registry = new ComponentRegistry(config.registryFile);
const graph = new KnowledgeGraph(config.graphFile);

const resonant = new ResonantBridge({ label: "control12-platform" });
const beliefGraph = new BeliefGraph({ resonant, maxNodes: 32 });
const { federation, jacobianTune } = bootV2({ config });

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
const codingQuorum = new CodingQuorum(enhanceCodingQuorumOptions({ agents, coding, bus }, config));
const chatWire = new ChatWire({ resonant, beliefGraph });

const artifacts = new ArtifactBuilder({ artifactDir: config.artifactDir, bus });
const deployments = new DeploymentCoordinator({ policy, bus, executor: config.deployExecutor });
const scheduler = new WorkflowScheduler({
  file: config.workflowFile,
  bus,
  agents,
  artifacts,
  deployments,
  coding,
  codingQuorum,
  maxConcurrent: config.maxConcurrentWorkflows
});
const supervisor = new RuntimeSupervisor({ config, bus, agents, registry, scheduler });

await policy.load();
await fs.mkdir(codeWorkspace, { recursive: true });
await fs.mkdir(config.root, { recursive: true });
await fs.mkdir(config.attestationDir, { recursive: true });

const beliefSeed = seedBeliefField(beliefGraph);

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
  capabilities: ["code.write", "code.edit", "code.execute", "code.quorum"],
  purpose: "Sandboxed coding agent with policy-bounded terminal and coding quorum loop."
});
await graph.upsertNode({ id: "code.workspace", type: "code", purpose: "coding agent workspace" });

await registry.register({
  id: "belief.graph",
  version: config.version,
  kind: "graph",
  capabilities: ["belief.upsert", "belief.link", "belief.tick"],
  purpose: "Multi-node belief field with relational coupling into ResonantBridge."
});
await graph.upsertNode({ id: "belief.graph", type: "graph", purpose: "multi-belief field" });

await registry.register({
  id: "chat.wire",
  version: config.version,
  kind: "bridge",
  capabilities: ["chat.session", "chat.turn"],
  purpose: "Avrone/Vercel chat wiring to lattice spectrum and tools."
});
await graph.upsertNode({ id: "chat.wire", type: "bridge", purpose: "chat wire" });

await registry.register({
  id: "federation.hub",
  version: config.version,
  kind: "federation",
  capabilities: ["federation.publish", "federation.ingest"],
  purpose: "Cross-node belief/spectrum digest exchange without workspace sharing."
});

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
    res.writeHead(200, {
      "content-type": `${type}; charset=utf-8`,
      "cache-control": "no-store"
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

function authMeta(req) {
  const hasBearer = Boolean((req.headers.authorization || "").match(/^Bearer\s+\S+/i));
  return hasBearer ? "bearer" : chatOpen ? "chat-open" : "none";
}

const tlsHandle = { current: null };

const v2ctx = () => ({
  readJson,
  requireAuth,
  sendJson,
  config,
  federation,
  jacobianTune,
  beliefGraph,
  resonant,
  buildSecurityStatus,
  accessLogPath,
  chatOpen,
  requireQuorum,
  tlsHandle,
  codingQuorum
});

const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${config.host}:${config.port}`}`);
  accessLog.instrument(req, res, {
    path: url.pathname,
    auth: authMeta(req),
    chatOpen
  });

  try {
    if (req.method === "OPTIONS") return sendOptions(res);

    if (req.method === "GET" && url.pathname === "/health") {
      const h = await supervisor.health();
      return sendJson(res, 200, {
        ...h,
        chatOpen,
        requireQuorum,
        accessLog: accessLogPath,
        mtls: process.env.CONTROL12_MTLS === "1",
        dualCa: Boolean(tlsHandle.current?.dualCa),
        version: config.version
      });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/security/status") {
      const status = await buildSecurityStatus({
        accessLogPath,
        chatOpen,
        requireQuorum,
        apiTokenConfigured: Boolean(config.apiToken)
      });
      return sendJson(res, 200, status);
    }

    const v2 = await handleV2Routes(req, res, url, v2ctx());
    if (v2 !== false) return v2;

    if (req.method === "GET" && url.pathname === "/api/v1/components") return sendJson(res, 200, await registry.list());
    if (req.method === "GET" && url.pathname === "/api/v1/agents") return sendJson(res, 200, agents.list());
    if (req.method === "GET" && url.pathname === "/api/v1/workflows") return sendJson(res, 200, await scheduler.list());
    if (req.method === "GET" && url.pathname === "/api/v1/graph") return sendJson(res, 200, await graph.snapshot());
    if (req.method === "GET" && url.pathname === "/api/v1/code/policy") {
      return sendJson(res, 200, {
        ...coding.getPolicySnapshot(),
        allowlistMode: strictAllowlist ? "strict" : "unrestricted",
        requireQuorum,
        chatOpen
      });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/audio/state") {
      return sendJson(res, 200, resonant.getState());
    }
    if (req.method === "GET" && url.pathname === "/api/v1/audio/spectrum") {
      return sendJson(res, 200, resonant.getSpectrum());
    }
    if (req.method === "GET" && url.pathname === "/api/v1/audio/prompt") {
      return sendJson(res, 200, {
        fragment: [resonant.toPromptFragment(), beliefGraph.toPromptFragment()].join(" ")
      });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/audio/history") {
      const limit = Number(url.searchParams.get("limit") || 8);
      return sendJson(res, 200, resonant.getHistory(limit));
    }

    if (req.method === "GET" && url.pathname === "/api/v1/belief/snapshot") {
      return sendJson(res, 200, beliefGraph.snapshot());
    }
    if (req.method === "GET" && url.pathname === "/api/v1/chat/tools") {
      return sendJson(res, 200, { tools: ChatWire.toolDescriptors() });
    }

    if (req.method === "POST" && url.pathname === "/api/v1/chat/session") {
      requireAuthUnlessChatOpen(req, config.apiToken);
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 201, chatWire.createSession({
        label: body.label,
        belief: body.belief,
        nodeId: body.nodeId ?? "avrone"
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/chat/turn") {
      requireAuthUnlessChatOpen(req, config.apiToken);
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, chatWire.prepareTurn(body.sessionId, {
        message: body.message,
        belief: body.belief
      }));
    }

    if (req.method === "POST") requireAuth(req, config.apiToken);

    if (req.method === "POST" && url.pathname === "/api/v1/security/tls/reload") {
      if (!tlsHandle.current?.setSecureContextFromDisk) {
        return sendJson(res, 400, { error: "TLS not enabled" });
      }
      const result = await tlsHandle.current.setSecureContextFromDisk();
      tlsHandle.current.dualCa = result.dualCa;
      try {
        await fs.unlink(path.join(resolveTlsPaths().dir, "RELOAD_REQUIRED"));
      } catch {
        /* optional */
      }
      await bus.publish("tls.reloaded", { dualCa: result.dualCa, caCount: result.caCount });
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/v1/audio/tick") {
      const body = await readJson(req, config.maxBodyBytes);
      const belief = body.belief != null ? Number(body.belief) : 0.5;
      const other = body.otherBelief != null ? Number(body.otherBelief) : null;
      return sendJson(res, 200, resonant.tick(belief, other));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/audio/silence") {
      return sendJson(res, 200, resonant.silence());
    }

    if (req.method === "POST" && url.pathname === "/api/v1/belief/node") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, beliefGraph.upsertNode(body.id, {
        belief: body.belief,
        label: body.label
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/belief/link") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, beliefGraph.link(body.a, body.b, body.weight));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/belief/set") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, beliefGraph.setBelief(body.id, body.belief));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/belief/tick") {
      return sendJson(res, 200, beliefGraph.tickAll());
    }

    if (req.method === "POST" && url.pathname === "/api/v1/code/write") {
      const body = await readJson(req, config.maxBodyBytes);
      if (requireQuorum) {
        return sendJson(res, 200, await codingQuorum.run({
          goal: body.goal || `write ${body.path}`,
          path: body.path,
          content: body.content ?? "",
          skipRemoteAgents: true
        }));
      }
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
      if (requireQuorum) {
        return sendJson(res, 200, await codingQuorum.run({
          goal: body.goal || `produce ${body.path}`,
          path: body.path,
          content: body.content ?? "",
          command: body.command ?? null,
          skipRemoteAgents: true
        }));
      }
      return sendJson(res, 200, await coding.produceAndRun({
        path: body.path,
        content: body.content ?? "",
        command: body.command ?? null
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/code/quorum") {
      const body = await readJson(req, config.maxBodyBytes);
      return sendJson(res, 200, await codingQuorum.run({
        goal: body.goal,
        path: body.path ?? null,
        content: body.content ?? null,
        command: body.command ?? null,
        skipRemoteAgents: Boolean(body.skipRemoteAgents)
      }));
    }
    if (req.method === "POST" && url.pathname === "/api/v1/workflows/from-template") {
      const body = await readJson(req, config.maxBodyBytes);
      let definition;
      if (body.template === "coding-quorum-full") {
        definition = codingQuorumFull(body);
      } else {
        definition = codingQuorumLocal(body);
      }
      const workflow = await scheduler.submit(definition);
      if (body.run === true) {
        return sendJson(res, 200, await scheduler.run(workflow.id));
      }
      return sendJson(res, 202, workflow);
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
};

const handle = createAppServer(handler);
tlsHandle.current = handle;
installTlsReloadSignal(handle);

const listenHost = process.env.CONTROL12_PLATFORM_BIND || config.host;

handle.server.listen(config.port, listenHost, () => {
  console.log(`CONTROL12 Sovereign Platform v${config.version} listening on ${handle.mode}://${listenHost}:${config.port}`);
  console.log(`Access log: ${accessLogPath}`);
  console.log(`mTLS: ${handle.mtls} dualCa: ${handle.dualCa}`);
  console.log(`Code workspace: ${codeWorkspace}`);
  console.log(`Belief field nodes: ${beliefSeed.snapshot.nodes.map(n => n.id).join(", ")}`);
  console.log(`chatOpen=${chatOpen} requireQuorum=${requireQuorum}`);
  console.log(`Code policy: ${JSON.stringify({
    ...coding.getPolicySnapshot(),
    allowlistMode: strictAllowlist ? "strict" : "unrestricted",
    requireQuorum,
    chatOpen
  })}`);
});
