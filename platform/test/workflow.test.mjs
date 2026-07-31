import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MessageBus } from "../src/bus/message-bus.mjs";
import { WorkflowScheduler } from "../src/scheduler/workflow-scheduler.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "control12-workflow-"));
const bus = new MessageBus({ eventFile: path.join(root, "events.jsonl") });
const scheduler = new WorkflowScheduler({
  file: path.join(root, "workflows.json"), bus, maxConcurrent: 1,
  agents: { invoke: async role => ({ status: "ok", role }) },
  artifacts: { build: async input => ({ status: "ok", input }) },
  deployments: { plan: async input => ({ status: "planned", input }) }
});

test("workflow scheduler executes typed steps", async () => {
  const workflow = await scheduler.submit({ name: "test", steps: [{ type: "agent", role: "verifier", message: "check" }, { type: "emit", topic: "test.event", payload: { ok: true } }] });
  const result = await scheduler.run(workflow.id);
  assert.equal(result.status, "completed");
  assert.equal(result.results.length, 2);
});
