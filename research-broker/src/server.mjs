import http from "node:http";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const HOST = process.env.CONTROL12_RESEARCH_HOST || "127.0.0.1";
const PORT = Number(process.env.CONTROL12_RESEARCH_PORT || 4330);
const ALLOW = new Set((process.env.CONTROL12_RESEARCH_ALLOW_HOSTS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
const MAX_BYTES = Number(process.env.CONTROL12_RESEARCH_MAX_BYTES || 2_000_000);
const TIMEOUT_MS = Number(process.env.CONTROL12_RESEARCH_TIMEOUT_MS || 15000);

function send(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(data, null, 2));
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const p = address.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
  }
  if (net.isIPv6(address)) {
    const a = address.toLowerCase();
    return a === "::1" || a.startsWith("fe80:") || a.startsWith("fc") || a.startsWith("fd");
  }
  return true;
}

async function validateTarget(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("only https research targets are allowed");
  const hostname = url.hostname.toLowerCase();
  if (!ALLOW.has(hostname)) throw new Error(`research host not allowlisted: ${hostname}`);
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!answers.length || answers.some(a => isPrivateAddress(a.address))) throw new Error("private or unresolved research target denied");
  return url;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function boundedText(response) {
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) throw new Error("research response exceeded size limit");
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok", requestId, allowHosts: [...ALLOW] });
    if (req.method !== "POST" || req.url !== "/v1/fetch") return send(res, 404, { error: "not found", requestId });
    const payload = await readJson(req);
    const url = await validateTarget(payload.url);
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "CONTROL12-ResearchBroker/0.1", "accept": "text/html,text/plain,application/json" } });
    const text = await boundedText(response);
    send(res, response.ok ? 200 : 502, {
      schema: "control12.research-result/v1",
      requestId,
      url: url.toString(),
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: text,
      observedAt: new Date().toISOString()
    });
  } catch (error) {
    send(res, 400, { error: error.message, requestId });
  }
}).listen(PORT, HOST, () => console.log(`CONTROL12 research broker listening on http://${HOST}:${PORT}`));
