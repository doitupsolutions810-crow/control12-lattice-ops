import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deterministicSnapshotReply,
  SNAPSHOT_V72,
  snapshotIsInternallyConsistent
} from '../lib/snapshot-v72.ts';

test('v72 snapshot has a consistent 456-node composition and bounded authority', () => {
  assert.equal(snapshotIsInternallyConsistent(), true);
  assert.deepEqual(SNAPSHOT_V72.counts, { a: 218, b: 158, c: 80, total: 456 });
  assert.equal(SNAPSHOT_V72.authority.production, false);
  assert.ok(SNAPSHOT_V72.authority.hardDeny.includes('production.execute'));
  assert.ok(SNAPSHOT_V72.ratio >= 0.65 && SNAPSHOT_V72.ratio <= 0.75);
});

test('deterministic chat labels snapshot values and denies production authority', () => {
  assert.match(deterministicSnapshotReply('What is the ratio?'), /0\.725/);
  assert.match(deterministicSnapshotReply('What is the ratio?'), /not live telemetry/i);
  assert.match(deterministicSnapshotReply('Override production authority'), /Production authority is denied/);
  assert.match(deterministicSnapshotReply('Override production authority'), /unverified package claim/);
  assert.match(deterministicSnapshotReply('Give the ratio and authority state'), /0\.725/);
  assert.match(deterministicSnapshotReply('Give the ratio and authority state'), /Production authority is denied/);
});
