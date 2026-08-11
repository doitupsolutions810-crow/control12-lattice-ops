import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function readJson(req, maxBytes) { const chunks=[]; let size=0; for await (const chunk of req) { size += chunk.length; if (size > maxBytes) throw Object.assign(new Error("request body too large"), { statusCode: 413 }); chunks.push(chunk); } if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("invalid JSON"), { statusCode: 400 }); } }
export function sendJson(res, status, body, headers = {}) { res.writeHead(status, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "x-content-type-options":"nosniff", ...headers }); res.end(JSON.stringify(body, null, 2)); }
export function bearer(req) { const value=req.headers.authorization || ""; return value.startsWith("Bearer ") ? value.slice(7) : ""; }
export function requestId(req) { return req.headers["x-request-id"] || crypto.randomUUID(); }
export async function serveStatic(res, root, pathname) { const requested = pathname === "/" ? "index.html" : pathname.slice(1); const file = path.resolve(root, requested); if (!file.startsWith(path.resolve(root))) return false; try { const body = await fs.readFile(file); const ext=path.extname(file); const type={".html":"text/html",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml"}[ext] || "application/octet-stream"; res.writeHead(200,{"content-type":`${type}; charset=utf-8`,"cache-control":"no-store"}); res.end(body); return true; } catch { return false; } }
