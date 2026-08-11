import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "control12-workspace-test-"));
process.env.CONTROL12_WORKSPACE_ROOT = root;

const workspace = await import(`../src/workspace.mjs?test=${Date.now()}`);
const policy = await import(`../src/policy.mjs?test=${Date.now()}`);

test("workspace writes are revisioned, chained, and readable", async () => {
  const first = await workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "generated/app.js", content: "console.log('ok')", actor: "tester" });
  const second = await workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "generated/app.js", content: "console.log('v2')", actor: "tester" });
  assert.match(first.contentDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.parent, null);
  assert.equal(second.parent, first.id);
  const read = await workspace.readWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "generated/app.js" });
  assert.equal(read.content, "console.log('v2')");
  const status = await workspace.workspaceStatus("t1", "w1");
  assert.equal(status.revisions, 2);
  assert.equal(status.lastRevision.id, second.id);
});

test("path traversal is denied", async () => {
  await assert.rejects(() => workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "../../escape", content: "no" }), /escape denied/);
  await assert.rejects(() => workspace.writeWorkspaceFile({ tenant: "..", workspaceId: "w1", relativePath: "source/no", content: "no" }), /invalid tenant/);
  await assert.rejects(() => workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "..", relativePath: "source/no", content: "no" }), /invalid workspaceId/);
  await assert.rejects(() => workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: "source\\..\\escape", content: "no" }), /escape denied/);
});

test("workspace control records are server-owned", async () => {
  for (const internalPath of [
    "workspace.manifest.json",
    "execution/revisions.jsonl",
    "memory/workspace.jsonl",
    "attestations/forged.json",
    "artifacts/unadmitted.tar"
  ]) {
    await assert.rejects(
      () => workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w1", relativePath: internalPath, content: "forged" }),
      /internal path write denied/
    );
  }
});

test("concurrent writes produce a linear hash-linked revision chain", async () => {
  const writes = Array.from({ length: 12 }, (_, index) => workspace.writeWorkspaceFile({
    tenant: "t1",
    workspaceId: "concurrent",
    relativePath: `generated/${index}.txt`,
    content: String(index),
    actor: "concurrency-test"
  }));
  await Promise.all(writes);
  const status = await workspace.workspaceStatus("t1", "concurrent");
  assert.equal(status.revisions, 12);
  const revisionFile = path.join(root, "t1", "concurrent", "execution", "revisions.jsonl");
  const records = (await fs.readFile(revisionFile, "utf8")).trim().split("\n").map(JSON.parse);
  for (let index = 1; index < records.length; index += 1) {
    assert.equal(records[index].parent, records[index - 1].id);
    assert.equal(records[index].parentHash, records[index - 1].recordHash);
  }
});

test("symlink traversal out of workspace is denied", async () => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "control12-outside-"));
  const workspaceRoot = path.join(root, "t1", "w2");
  await workspace.ensureWorkspace("t1", "w2");
  await fs.symlink(outside, path.join(workspaceRoot, "generated", "escape-link"));
  await assert.rejects(
    () => workspace.writeWorkspaceFile({ tenant: "t1", workspaceId: "w2", relativePath: "generated/escape-link/pwned.txt", content: "no" }),
    /symlink traversal denied/
  );
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
