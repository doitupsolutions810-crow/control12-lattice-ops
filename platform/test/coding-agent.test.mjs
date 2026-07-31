import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CodingAgent } from '../src/agents/coding-agent.mjs';

describe('CodingAgent sandbox', () => {
  let root;
  let agent;

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'c12-code-'));
    agent = new CodingAgent({
      workspaceRoot: root,
      localAgentUrl: 'http://127.0.0.1:4312'
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
    await assert.rejects(() => agent.writeFile('../outside.txt', 'x'), /escapes workspace/);
  });

  it('edits file content', async () => {
    await agent.writeFile('edit.txt', 'alpha beta');
    await agent.editFile('edit.txt', 'beta', 'gamma');
    const r = await agent.readFile('edit.txt');
    assert.equal(r.content, 'alpha gamma');
  });
});
