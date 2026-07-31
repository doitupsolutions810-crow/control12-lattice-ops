import crypto from "node:crypto";

function safeEqual(a, b) {
  const left = Buffer.from(a || "");
  const right = Buffer.from(b || "");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

const CORS_HEADERS = {
  "access-control-allow-origin": process.env.CONTROL12_CORS_ORIGIN || "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-max-age": "86400"
};

export async function readJson(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function sendJson(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'",
    ...CORS_HEADERS
  });
  res.end(`${JSON.stringify(value, null, 2)}\n`);
}

export function sendOptions(res) {
  res.writeHead(204, CORS_HEADERS);
  res.end();
}

export function requireAuth(req, token) {
  if (!token) return;
  const supplied = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(supplied, token)) {
    const error = new Error("unauthorized");
    error.statusCode = 401;
    throw error;
  }
}

/** Auth for chat session/turn only — skip when CONTROL12_CHAT_OPEN=1. */
export function requireAuthUnlessChatOpen(req, token) {
  if (process.env.CONTROL12_CHAT_OPEN === "1") return;
  requireAuth(req, token);
}
