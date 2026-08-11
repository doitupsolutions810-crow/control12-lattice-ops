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
