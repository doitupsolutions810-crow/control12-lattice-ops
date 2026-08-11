import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "control12-workspace-test-"));
process.env.CONTROL12_WORKSPACE_ROOT = root;

const workspace = await import(`../src/workspace.mjs?test=${Date.now()}`);
const policy = await import(`../src/policy.mjs?test=${Date.now()}`);

test("workspace writes are revisioned and readable", async () => {
  const revision = await workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "generated/app.js", content: "console.log('ok')", actor: "tester" });
  assert.match(revision.contentDigest, /^sha256:[a-f0-9]{64}$/);
  const read = await workspace.readWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "generated/app.js" });
  assert.equal(read.content, "console.log('ok')");
  const status = await workspace.workspaceStatus("t1", "w1");
  assert.equal(status.revisions, 1);
});

test("path traversal is denied", async () => {
  await assert.rejects(() => workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "../../escape", content: "no" }), /escape denied/);
});

test("workspace memory is scoped", async () => {
  await workspace.appendMemory({ tenant: "t1", workspaceId: "w1", scope: "workspace", content: "alpha" });
  await workspace.appendMemory({ tenant: "t1", workspaceId: "w1", scope: "project", content: "beta" });
  const records = await workspace.readMemory({ tenant: "t1", workspaceId: "w1", scope: "workspace" });
  assert.equal(records.length, 1);
  assert.equal(records[0].content, "alpha");
});

test("production and secret capabilities are hard denied", () => {
  assert.throws(() => policy.assertCapability("supervisor", "production.execute"), /denied/);
  assert.throws(() => policy.assertCapability("coding", "secret.read"), /denied/);
  assert.doesNotThrow(() => policy.assertCapability("coding", "workspace.write"));
});
