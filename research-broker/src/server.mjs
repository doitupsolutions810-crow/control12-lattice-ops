import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import fs from "node:fs";

const HOST = process.env.CONTROL12_RESEARCH_HOST || "127.0.0.1";
const PORT = Number(process.env.CONTROL12_RESEARCH_PORT || 4330);
const ALLOW = new Set((process.env.CONTROL12_RESEARCH_ALLOW_HOSTS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
const MAX_BYTES = Number(process.env.CONTROL12_RESEARCH_MAX_BYTES || 2_000_000);
const MAX_REQUEST_BYTES = Number(process.env.CONTROL12_RESEARCH_MAX_REQUEST_BYTES || 64_000);
const TIMEOUT_MS = Number(process.env.CONTROL12_RESEARCH_TIMEOUT_MS || 15000);
const TOKEN_FILE = process.env.CONTROL12_RESEARCH_TOKEN_FILE || "";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function loadToken(file) {
  if (!file) return "";
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("research token file must be a regular non-symlink file");
  if ((stat.mode & 0o077) !== 0) throw new Error("research token file permissions must deny group and other access");
  const token = fs.readFileSync(file, "utf8").trim();
  if (Buffer.byteLength(token) < 32 || Buffer.byteLength(token) > 4096) throw new Error("research token length is invalid");
  return token;
}

const TOKEN = loadToken(TOKEN_FILE);
if (!LOOPBACK_HOSTS.has(HOST) && !TOKEN) {
  throw new Error("CONTROL12_RESEARCH_TOKEN_FILE is required when research broker binds beyond loopback");
}

function safeEqual(expected, supplied) {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorize(req) {
  if (!TOKEN) return;
  const value = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const supplied = typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7) : "";
  if (!safeEqual(TOKEN, supplied)) throw new Error("research authorization denied");
}

function send(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(data, null, 2));
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const p = address.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] >= 224);
  }
  if (net.isIPv6(address)) {
    const a = address.toLowerCase();
    return a === "::" || a === "::1" || a.startsWith("fe80:") || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("ff");
  }
  return true;
}

async function validateTarget(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("only https research targets are allowed");
  if (url.username || url.password) throw new Error("research target credentials are not allowed");
  const hostname = url.hostname.toLowerCase();
  if (!ALLOW.has(hostname)) throw new Error(`research host not allowlisted: ${hostname}`);
  const answers = await dns.lookup(hostname, { all: true, verbatim: true });
  const publicAnswers = answers.filter(a => !isPrivateAddress(a.address));
  if (!answers.length || publicAnswers.length !== answers.length) throw new Error("private or unresolved research target denied");
  return { url, pinned: publicAnswers[0] };
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_REQUEST_BYTES) throw new Error("research request body exceeded size limit");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function pinnedHttpsText(url, pinned) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = https.get(url, {
      headers: {
        "user-agent": "CONTROL12-ResearchBroker/0.2",
        "accept": "text/html,text/plain,application/json"
      },
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family)
    }, response => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400) {
        response.resume();
        return reject(new Error("research redirects are denied"));
      }
      const chunks = [];
      let total = 0;
      response.on("data", chunk => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          request.destroy(new Error("research response exceeded size limit"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          status,
          contentType: response.headers["content-type"] || null,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });
    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error("research request timed out")));
    request.on("error", error => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

http.createServer(async (req, res) => {
  const requestId = crypto.randomUUID();
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok", requestId, authenticationRequired: Boolean(TOKEN) });
    if (req.method !== "POST" || req.url !== "/v1/fetch") return send(res, 404, { error: "not found", requestId });
    authorize(req);
    const payload = await readJson(req);
    const { url, pinned } = await validateTarget(payload.url);
    const result = await pinnedHttpsText(url, pinned);
    send(res, result.status >= 200 && result.status < 300 ? 200 : 502, {
      schema: "control12.research-result/v1",
      requestId,
      url: url.toString(),
      status: result.status,
      contentType: result.contentType,
      body: result.body,
      observedAt: new Date().toISOString()
    });
  } catch (error) {
    send(res, 400, { error: error.message, requestId });
  }
}).listen(PORT, HOST, () => console.log(`CONTROL12 research broker listening on http://${HOST}:${PORT}`));
