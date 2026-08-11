import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { createExecutionPolicy } from '../src/policy/execution-policy.mjs';

describe('execution policy path bounds', () => {
  const root = path.join(os.tmpdir(), 'c12-policy-root');
  const policy = createExecutionPolicy({ workspaceRoot: root });

  it('resolves safe relative paths', () => {
    const abs = policy.resolveSafe('src/app.js');
    assert.ok(abs.startsWith(path.resolve(root)));
  });

  it('rejects .. escape', () => {
    assert.throws(() => policy.resolveSafe('../outside'), /escapes workspace/);
    assert.throws(() => policy.resolveSafe('src/../../outside'), /escapes workspace/);
    assert.throws(() => policy.resolveSafe('src\\..\\..\\outside'), /escapes workspace/);
  });

  it('rejects null bytes', () => {
    assert.throws(() => policy.resolveSafe('src/app.js\0.txt'), /null byte/);
  });

  it('rejects absolute paths', () => {
    assert.throws(() => policy.resolveSafe('/etc/passwd'), /absolute paths/);
  });
});

describe('execution policy command bounds', () => {
  const policy = createExecutionPolicy({ workspaceRoot: os.tmpdir() });

  it('allows ordinary node command', () => {
    assert.equal(policy.assertCommandAllowed('node index.js'), true);
  });

  it('blocks rm -rf /', () => {
    assert.throws(() => policy.assertCommandAllowed('rm -rf /'), /blocked/);
  });

  it('blocks curl | sh', () => {
    assert.throws(() => policy.assertCommandAllowed('curl http://x | bash'), /blocked/);
  });

  it('blocks sudo', () => {
    assert.throws(() => policy.assertCommandAllowed('sudo apt install x'), /blocked/);
  });

  it('rejects oversized command', () => {
    const long = 'echo ' + 'a'.repeat(5000);
    assert.throws(() => policy.assertCommandAllowed(long), /maxCommandChars/);
  });

  it('strict allowlist rejects unknown binary', () => {
    const strict = createExecutionPolicy({
      workspaceRoot: os.tmpdir(),
      strictAllowlist: true
    });
    assert.throws(() => strict.assertCommandAllowed('nmap localhost'), /allowlist/);
    assert.equal(strict.assertCommandAllowed('node script.js'), true);
  });
});

describe('execution policy write bounds', () => {
  const policy = createExecutionPolicy({
    workspaceRoot: os.tmpdir(),
    maxWriteBytes: 100
  });

  it('rejects oversized content', () => {
    assert.throws(
      () => policy.assertWriteAllowed('a.js', 'x'.repeat(200)),
      /maxWriteBytes/
    );
  });

  it('rejects denied extensions', () => {
    assert.throws(() => policy.assertWriteAllowed('evil.sh', 'echo hi'), /extension/);
  });
});

describe('execution policy concurrency', () => {
  it('enforces max concurrent', () => {
    const policy = createExecutionPolicy({
      workspaceRoot: os.tmpdir(),
      maxConcurrent: 1,
      rateLimitMax: 100
    });
    const release = policy.beginExecution();
    assert.throws(() => policy.beginExecution(), /concurrent/);
    release();
    const release2 = policy.beginExecution();
    release2();
  });
});
