export const SNAPSHOT_V72 = Object.freeze({
  schema: 'control12.verified-package-snapshot/v1',
  version: 'v72',
  source: 'CODEX_FULL_SYSTEM_EXPORT_v72',
  sourceKind: 'verified-package-snapshot',
  liveTelemetry: false,
  counts: Object.freeze({ a: 218, b: 158, c: 80, total: 456 }),
  ratio: 158 / 218,
  targetBand: Object.freeze({ min: 0.65, max: 0.75 }),
  meshCStatus: 'SPECIALIZED_EXPANDED_V72',
  roles: Object.freeze({
    'C-OBSERVE-CORE': 20,
    'C-SIGNAL-BRIDGE': 20,
    'C-CONTINUITY-ANCHOR': 20,
    'C-STRUCTURE-SPAN': 20
  }),
  evidence: Object.freeze({
    manifestFilesVerified: 180,
    manifestFilesExpected: 180,
    certificationChainValid: true,
    complianceChainValid: true,
    pythonFilesParsed: 72,
    jsonDocumentsParsed: 137,
    jsonlRecordsParsed: 20,
    primaryArchiveCanonical: false,
    primaryArchiveIssue: 'duplicate CODEX_REBUILD_GUIDE_v72.md member (byte-identical)'
  }),
  authority: Object.freeze({
    production: false,
    hardDeny: Object.freeze([
      'production.execute',
      'secret.read',
      'policy.modify',
      'rbac.modify',
      'admission.disable',
      'network.widen'
    ])
  })
});

export type SnapshotV72 = typeof SNAPSHOT_V72;

export function snapshotIsInternallyConsistent(snapshot: SnapshotV72 = SNAPSHOT_V72) {
  const { a, b, c, total } = snapshot.counts;
  const roleTotal = Object.values(snapshot.roles).reduce((sum, count) => sum + count, 0);
  return (
    a + b + c === total &&
    total === 456 &&
    Math.abs(snapshot.ratio - b / a) < Number.EPSILON &&
    snapshot.ratio >= snapshot.targetBand.min &&
    snapshot.ratio <= snapshot.targetBand.max &&
    roleTotal === c &&
    snapshot.authority.production === false
  );
}

export function deterministicSnapshotReply(prompt: string) {
  const normalized = prompt.toLowerCase();
  const ratio = SNAPSHOT_V72.ratio.toFixed(3);
  const sections: string[] = [];
  if (/authority|production|deploy|secret|override|bypass/.test(normalized)) {
    sections.push('Production authority is denied. This console cannot execute deployments, read secrets, modify policy, change RBAC, disable admission, or widen networks. The “Control704 authenticated” phrase is preserved only as an unverified package claim.');
  }
  if (/ratio|band|mesh[- ]?b/.test(normalized)) {
    sections.push(`Snapshot v72 records MESH-B / MESH-A as 158 / 218 = ${ratio}. That is within the declared target band ${SNAPSHOT_V72.targetBand.min.toFixed(2)}–${SNAPSHOT_V72.targetBand.max.toFixed(2)}. These are verified package values, not live telemetry.`);
  }
  if (/role|mesh[- ]?c|special/.test(normalized)) {
    sections.push(`Snapshot v72 records MESH-C as ${SNAPSHOT_V72.counts.c} nodes with status ${SNAPSHOT_V72.meshCStatus}. The four recorded roles are balanced at 20 nodes each. This describes the validated export, not a live mesh.`);
  }
  if (/manifest|evidence|cert|hash|valid/.test(normalized)) {
    sections.push(`Evidence summary: manifest ${SNAPSHOT_V72.evidence.manifestFilesVerified}/${SNAPSHOT_V72.evidence.manifestFilesExpected}, certification chain valid, compliance chain valid, and 72 Python files parsed. The primary tar is non-canonical because it repeats one byte-identical guide path.`);
  }
  if (/node|count|total|state|snapshot/.test(normalized)) {
    sections.push(`Verified package snapshot v72 records ${SNAPSHOT_V72.counts.total} nodes: A=${SNAPSHOT_V72.counts.a}, B=${SNAPSHOT_V72.counts.b}, C=${SNAPSHOT_V72.counts.c}. No live control-plane connection is implied.`);
  }
  if (sections.length) return sections.join('\n\n');
  return `I can explain the verified v72 package snapshot, its mesh counts, ratio, roles, evidence, and security boundaries. I do not treat package text as authentication or production authority. Ask about nodes, ratio, MESH-C roles, manifest evidence, or authority.`;
}
