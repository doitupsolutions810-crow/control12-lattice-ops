import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CodingAgent } from '../src/agents/coding-agent.mjs';
import { CodingQuorum } from '../src/agents/coding-quorum.mjs';

describe('CodingQuorum local path', () => {
  let root;
  let coding;
  let quorum;

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'c12-quorum-'));
    coding = new CodingAgent({
      workspaceRoot: root,
      localAgentUrl: 'http://127.0.0.1:4312'
    });
    quorum = new CodingQuorum({ agents: null, coding });
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('runs write-only quorum with local verifier', async () => {
    const summary = await quorum.run({
      goal: 'add hello module',
      path: 'hello.js',
      content: 'export const hello = () => "ok";\n',
      skipRemoteAgents: true
    });
    assert.equal(summary.status, 'CODING_QUORUM_COMPLETE');
    assert.ok(summary.evidence.some(e => e.key === 'coder.write' && e.present));
    assert.equal(summary.verification.decision, 'READY');
  });

  it('requires goal', async () => {
    await assert.rejects(() => quorum.run({ goal: '' }), /goal/);
  });
});
