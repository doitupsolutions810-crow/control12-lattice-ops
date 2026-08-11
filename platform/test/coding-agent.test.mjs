import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CodingAgent } from '../src/agents/coding-agent.mjs';

describe('CodingAgent sandbox + policy', () => {
  let root;
  let agent;

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'c12-code-'));
    agent = new CodingAgent({
      workspaceRoot: root,
      localAgentUrl: 'http://127.0.0.1:4312',
      policyOptions: { maxWriteBytes: 10_000 }
    });
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('writes and reads a file inside workspace', async () => {
    const w = await agent.writeFile('hello.js', 'console.log("ok")\n');
    assert.equal(w.ok, true);
    const r = await agent.readFile('hello.js');
    assert.match(r.content, /console\.log/);
  });

  it('rejects path escape', async () => {
    await assert.rejects(() => agent.writeFile('../outside.txt', 'x'), /escapes workspace|absolute/);
  });

  it('rejects absolute path', async () => {
    await assert.rejects(() => agent.writeFile('/tmp/x.txt', 'x'), /absolute/);
  });

  it('edits file content', async () => {
    await agent.writeFile('edit.txt', 'alpha beta');
    await agent.editFile('edit.txt', 'beta', 'gamma');
    const r = await agent.readFile('edit.txt');
    assert.equal(r.content, 'alpha gamma');
  });

  it('rejects shell script write by extension', async () => {
    await assert.rejects(() => agent.writeFile('run.sh', 'echo hi'), /extension/);
  });

  it('blocks destructive command before network hop', async () => {
    await assert.rejects(() => agent.execute('rm -rf /'), /blocked/);
  });

  it('exposes policy snapshot', () => {
    const snap = agent.getPolicySnapshot();
    assert.ok(snap.workspaceRoot);
    assert.ok(snap.maxWriteBytes > 0);
  });
});
