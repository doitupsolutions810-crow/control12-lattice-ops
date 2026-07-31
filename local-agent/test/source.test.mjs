import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
const cli = await readFile(new URL("../src/cli.mjs", import.meta.url), "utf8");

test("server exposes five distinct agents", () => {
  for (const role of ["planner", "engineer", "artifact", "operations", "verifier"]) {
    assert.match(server, new RegExp(`\\b${role}\\b`));
  }
});

test("server has evidence-grounded quorum and localhost binding", () => {
  assert.match(server, /LOCAL_EVIDENCE_QUORUM_COMPLETE/);
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /collectEvidence/);
  assert.match(server, /response_format/);
});

test("server exposes upgraded agent and evidence endpoints", () => {
  assert.match(server, /\/api\/agents/);
  assert.match(server, /\/api\/evidence/);
  assert.match(server, /LOCAL_AGENT_COMPLETE/);
  assert.match(server, /COMMAND_TIMEOUT_MS/);
  assert.match(server, /MAX_COMMAND_OUTPUT/);
});

test("cli separates chat, quorum, and single-agent execution", () => {
  assert.match(cli, /mode=quorum/);
  assert.match(cli, /900000/);
  assert.match(cli, /case "agent"/);
  assert.match(cli, /case "evidence"/);
});
