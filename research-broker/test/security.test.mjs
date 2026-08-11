import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const serverPath = path.resolve("src/server.mjs");

function runServer(env) {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  return { child, output: () => output };
}

function waitForExit(child) {
  return new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
}

async function waitForReady(processResult) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (processResult.output().includes("research broker listening")) return;
    if (processResult.child.exitCode !== null) throw new Error(`server exited before ready: ${processResult.output()}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`server did not become ready: ${processResult.output()}`);
}

test("non-loopback startup fails closed without a token file", async () => {
  const processResult = runServer({ CONTROL12_RESEARCH_HOST: "0.0.0.0", CONTROL12_RESEARCH_TOKEN_FILE: "" });
  const result = await waitForExit(processResult.child);
  assert.notEqual(result.code, 0);
  assert.match(processResult.output(), /TOKEN_FILE is required/);
});

test("token files must be regular, private, and non-empty", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "control12-research-test-"));
  const tokenFile = path.join(root, "token");
  await fs.writeFile(tokenFile, "x".repeat(32), { mode: 0o644 });
  const processResult = runServer({ CONTROL12_RESEARCH_HOST: "0.0.0.0", CONTROL12_RESEARCH_TOKEN_FILE: tokenFile });
  const result = await waitForExit(processResult.child);
  assert.notEqual(result.code, 0);
  assert.match(processResult.output(), /permissions must deny group and other access/);
  await fs.chmod(tokenFile, 0o600);
  await fs.writeFile(tokenFile, "short", { mode: 0o600 });
  const shortResult = runServer({ CONTROL12_RESEARCH_HOST: "0.0.0.0", CONTROL12_RESEARCH_TOKEN_FILE: tokenFile });
  const shortExit = await waitForExit(shortResult.child);
  assert.notEqual(shortExit.code, 0);
  assert.match(shortResult.output(), /token length is invalid/);
});

test("configured missing token file fails with a controlled error", async () => {
  const processResult = runServer({
    CONTROL12_RESEARCH_HOST: "0.0.0.0",
    CONTROL12_RESEARCH_TOKEN_FILE: path.join(os.tmpdir(), `missing-control12-token-${process.pid}`)
  });
  const result = await waitForExit(processResult.child);
  assert.notEqual(result.code, 0);
  assert.match(processResult.output(), /research token file is unavailable/);
  assert.doesNotMatch(processResult.output(), /ENOENT.*lstat/);
});

test("bearer authentication rejects missing and incorrect tokens", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "control12-research-auth-"));
  const tokenFile = path.join(root, "token");
  const token = "t".repeat(48);
  await fs.writeFile(tokenFile, token, { mode: 0o600 });
  const port = 20000 + (process.pid % 10000);
  const processResult = runServer({
    CONTROL12_RESEARCH_HOST: "127.0.0.1",
    CONTROL12_RESEARCH_PORT: String(port),
    CONTROL12_RESEARCH_TOKEN_FILE: tokenFile
  });
  t.after(() => processResult.child.kill("SIGTERM"));
  await waitForReady(processResult);

  const missing = await fetch(`http://127.0.0.1:${port}/v1/fetch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" })
  });
  assert.equal(missing.status, 403);

  const incorrect = await fetch(`http://127.0.0.1:${port}/v1/fetch`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer incorrect-token" },
    body: JSON.stringify({ url: "https://example.com" })
  });
  assert.equal(incorrect.status, 403);

  const authenticated = await fetch(`http://127.0.0.1:${port}/v1/fetch`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({})
  });
  assert.equal(authenticated.status, 400);
  assert.match((await authenticated.json()).error, /Invalid URL/);
});
