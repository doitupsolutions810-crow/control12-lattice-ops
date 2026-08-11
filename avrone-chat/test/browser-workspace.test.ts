import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WORKSPACE,
  isSafeWorkspacePath,
  saveWorkspaceFile
} from '../lib/browser-workspace.ts';

test('workspace path confinement rejects traversal, absolute, null, and Windows paths', () => {
  assert.equal(isSafeWorkspacePath('src/index.ts'), true);
  assert.equal(isSafeWorkspacePath('../../escape'), false);
  assert.equal(isSafeWorkspacePath('/etc/passwd'), false);
  assert.equal(isSafeWorkspacePath('src\\escape.ts'), false);
  assert.equal(isSafeWorkspacePath('src/evil\0.ts'), false);
});

test('workspace saves emit a linear hash-linked revision chain', async () => {
  const first = await saveWorkspaceFile(DEFAULT_WORKSPACE, 'src/lattice.ts', 'first', '2026-08-11T00:00:00.000Z');
  const second = await saveWorkspaceFile(first, 'src/lattice.ts', 'second', '2026-08-11T00:00:01.000Z');
  assert.equal(second.files.find(file => file.path === 'src/lattice.ts')?.content, 'second');
  assert.match(first.revisions[0].contentDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(second.revisions[1].recordHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(second.revisions[1].parent, first.revisions[0].recordHash);
});
