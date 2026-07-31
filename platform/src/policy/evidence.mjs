/**
 * Policy-as-evidence — portable evidence records for quorum, CI, and deploy.
 */

import crypto from 'node:crypto';

export function buildEvidenceRecord({
  kind,
  subject,
  policyDecision = null,
  tests = null,
  digests = null,
  extra = null
}) {
  const record = {
    schema: 'control12.evidence/v1',
    kind,
    subject,
    at: new Date().toISOString(),
    policyDecision,
    tests,
    digests,
    extra
  };
  const canonical = JSON.stringify(record);
  record.recordDigest = crypto.createHash('sha256').update(canonical).digest('hex');
  return record;
}

export function assertEvidenceReady(record, { requirePolicy = false, requireTests = false } = {}) {
  const failures = [];
  if (!record?.recordDigest) failures.push('missing_record_digest');
  if (requirePolicy && !record.policyDecision) failures.push('missing_policy');
  if (requireTests && !record.tests) failures.push('missing_tests');
  return { ok: failures.length === 0, failures };
}

export default { buildEvidenceRecord, assertEvidenceReady };
