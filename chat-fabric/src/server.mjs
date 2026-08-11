import http from "node:http";
import crypto from "node:crypto";
import { assertCapability, capabilitySnapshot } from "./policy.mjs";
import { appendMemory, readMemory, readWorkspaceFile, workspaceStatus, writeWorkspaceFile } from "./workspace.mjs";

const HOST = process.env.CONTROL12_CHAT_HOST || "127.0.0.1";
const PORT = Number(process.env.CONTROL12_CHAT_PORT || 4320);
const MAX_BODY = Number(process.env.CONTROL12_CHAT_MAX_BODY || 2_000_000);
const GATEWAY_SECRET = process.env.CONTROL12_GATEWAY_SECRET || "";
const IDENTITY_MAX_SKEW_SECONDS = Number(process.env.CONTROL12_IDENTITY_MAX_SKEW_SECONDS || 60);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

if (!LOOPBACK_HOSTS.has(HOST) && !GATEWAY_SECRET) {
  throw new Error("CONTROL12_GATEWAY_SECRET is required when chat fabric binds beyond loopback");
}

function send(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(data, null, 2));
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("request body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function header(req, name, fallback = "") {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] || fallback : value || fallback;
}

function safeEqualHex(expected, supplied) {
  if (!/^[a-f0-9]{64}$/i.test(supplied || "")) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(supplied, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function identity(req) {
  const asserted = {
    tenant: String(header(req, "x-control12-tenant", "default")),
    workspaceId: String(header(req, "x-control12-workspace", "default")),
    role: String(header(req, "x-control12-role", "user")),
    actor: String(header(req, "x-control12-actor", "chat-user"))
  };

  if (!GATEWAY_SECRET) {
    return { ...asserted, role: "user", actor: "local-user", identitySource: "loopback-local" };
  }

  const timestamp = String(header(req, "x-control12-identity-timestamp"));
  const signature = String(header(req, "x-control12-identity-signature"));
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > IDENTITY_MAX_SKEW_SECONDS) {
    throw new Error("identity assertion expired or invalid");
  }

  const canonical = [asserted.tenant, asserted.workspaceId, asserted.role, asserted.actor, timestamp].join("\n");
  const expected = crypto.createHmac("sha256", GATEWAY_SECRET).update(canonical).digest("hex");
  if (!safeEqualHex(expected, signature)) throw new Error("identity assertion signature invalid");
  return { ...asserted, identitySource: "signed-gateway" };
}

function researchRequest(payload, id) {
  return {
    schema: "control12.tool-request/v1",
    id,
    toolClass: "network.research",
    query: String(payload.query || ""),
    mode: payload.mode || "analysis",
    state: "PROPOSED",
    executionBoundary: "external-tool-broker",
    note: "This service records and governs the request; a separately authorized network tool broker performs live retrieval."
  };
}

function artifactRequest(payload, id) {
  return {
    schema: "control12.artifact-request/v1",
    id,
    kind: payload.kind || "workspace-bundle",
    entrypoint: payload.entrypoint || null,
    runtime: payload.runtime || "container",
    publishTarget: payload.publishTarget || "staging",
    state: "PROPOSED",
    executionBoundary: "artifact-runtime-broker"
  };
}

const server = http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { status: "ok", service: "control12-chat-workspace-fabric", requestId, identityMode: GATEWAY_SECRET ? "signed-gateway" : "loopback-local" });
    }

    const who = identity(req);

    if (req.method === "GET" && url.pathname === "/v1/capabilities") {
      return send(res, 200, capabilitySnapshot());
    }
    if (req.method === "GET" && url.pathname === "/v1/workspace") {
      assertCapability(who.role, "workspace.read");
      return send(res, 200, await workspaceStatus(who.tenant, who.workspaceId));
    }
    if (req.method === "POST" && url.pathname === "/v1/files/write") {
      assertCapability(who.role, "workspace.write");
      const payload = await body(req);
      const revision = await writeWorkspaceFile({ ...who, relativePath: payload.path, content: payload.content });
      return send(res, 201, { requestId, revision });
    }
    if (req.method === "POST" && url.pathname === "/v1/files/read") {
      assertCapability(who.role, "workspace.read");
      const payload = await body(req);
      return send(res, 200, { requestId, ...(await readWorkspaceFile({ ...who, relativePath: payload.path })) });
    }
    if (req.method === "POST" && url.pathname === "/v1/memory/append") {
      assertCapability(who.role, "memory.write");
      const payload = await body(req);
      return send(res, 201, { requestId, memory: await appendMemory({ ...who, scope: payload.scope, kind: payload.kind, content: payload.content, metadata: payload.metadata }) });
    }
    if (req.method === "GET" && url.pathname === "/v1/memory") {
      assertCapability(who.role, "memory.read");
      return send(res, 200, { requestId, records: await readMemory({ ...who, scope: url.searchParams.get("scope") || "workspace", limit: url.searchParams.get("limit") || 50 }) });
    }
    if (req.method === "POST" && url.pathname === "/v1/research") {
      assertCapability(who.role, "research.request");
      const payload = await body(req);
      const proposal = researchRequest(payload, requestId);
      await appendMemory({ ...who, kind: "tool-request", content: proposal.query, metadata: proposal });
      return send(res, 202, proposal);
    }
    if (req.method === "POST" && url.pathname === "/v1/artifacts") {
      assertCapability(who.role, "artifact.request");
      const payload = await body(req);
      const proposal = artifactRequest(payload, requestId);
      await appendMemory({ ...who, kind: "artifact-request", content: JSON.stringify(proposal), metadata: proposal });
      return send(res, 202, proposal);
    }
    if (req.method === "POST" && url.pathname === "/v1/chat/context") {
      assertCapability(who.role, "chat.send");
      const payload = await body(req);
      const memory = await readMemory({ ...who, scope: payload.scope || "workspace", limit: payload.memoryLimit || 25 });
      const workspace = await workspaceStatus(who.tenant, who.workspaceId);
      const context = {
        schema: "control12.chat-context/v1",
        requestId,
        identity: who,
        prompt: String(payload.prompt || ""),
        memory,
        workspace,
        capabilities: capabilitySnapshot().roles[who.role] || [],
        nextBoundary: "model-or-supervisor",
        productionAuthority: false
      };
      await appendMemory({ ...who, kind: "user-message", content: context.prompt, metadata: { requestId } });
      return send(res, 200, context);
    }

    send(res, 404, { error: "not found", requestId });
  } catch (error) {
    const forbidden = /denied|not granted|identity assertion/.test(error.message);
    send(res, forbidden ? 403 : 400, { error: error.message, requestId });
  }
});

server.listen(PORT, HOST, () => console.log(`CONTROL12 chat workspace fabric listening on http://${HOST}:${PORT}`));
