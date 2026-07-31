const DEFAULT_ENDPOINTS = Object.freeze({
  operations: "https://control12-operations-plane.vercel.app/api/v1/operations/readiness",
  success: "https://control12-success-plane.vercel.app/api/v1/success/live",
  evidenceStatus: "https://control12-evidence-console.vercel.app/api/status",
  evidenceSchema: "https://control12-evidence-console.vercel.app/api/v1/evidence/schema"
});

const EXPECTED_TRUST = Object.freeze({
  version: "5.3.1",
  runtime: "static",
  privacy: "local-only",
  mandatoryGates: 7,
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: "production-acceptance",
  requiredEnvironment: "production"
});

function findValue(value, key, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  for (const child of Object.values(value)) {
    const found = findValue(child, key, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}

function verifyTrust(statusDocument, schemaDocument) {
  const merged = { statusDocument, schemaDocument };
  const mismatches = [];
  for (const [key, expected] of Object.entries(EXPECTED_TRUST)) {
    const actual = findValue(merged, key);
    if (actual !== expected) mismatches.push({ key, expected, actual });
  }
  return { verified: mismatches.length === 0, mismatches };
}

export function evaluateProcurement({ operations, success, evidenceStatus, evidenceSchema }) {
  const evidenceReachable = Boolean(evidenceStatus && evidenceSchema);
  const trust = evidenceReachable
    ? verifyTrust(evidenceStatus, evidenceSchema)
    : { verified: false, mismatches: [{ key: "evidenceEndpoints", expected: "HTTP 200", actual: "unavailable" }] };

  const g0 = success?.results?.find(result => result.id === "G0");
  const provider = operations?.components?.find(component => component.name === "provider-telemetry");
  const baselineReady = g0?.status === "PASS" && provider?.ready === true;
  const productionReady =
    success?.decision === "GO" &&
    operations?.operational === true &&
    operations?.phase === "READY" &&
    trust.verified;

  let procurementDecision = "READY_FOR_PROCUREMENT";
  let plainLanguage = "The controlled purchase can proceed while production remains disabled pending acceptance evidence.";

  if (!trust.verified) {
    procurementDecision = "HOLD_EVIDENCE_CONTROL";
    plainLanguage = "Restore and verify the evidence rules before approving a purchase.";
  } else if (!baselineReady) {
    procurementDecision = "HOLD_BASELINE_CONTROL";
    plainLanguage = "Restore the existing control plane or provider reachability before approving a purchase.";
  }

  return {
    schema: "control12.procurement-evaluation/v1",
    observedAt: new Date().toISOString(),
    procurementDecision,
    productionDecision: productionReady ? "GO" : "NO_GO",
    operationsPhase: operations?.phase ?? "UNKNOWN",
    productionScore: success?.score ?? null,
    plainLanguage,
    trust,
    baseline: {
      governedControlPlane: g0?.status ?? "UNKNOWN",
      providerTelemetryReady: provider?.ready ?? false
    },
    procurementBundles: [
      { id: "B1", name: "Managed foundation", covers: ["G1", "G2", "G4"] },
      { id: "B2", name: "Worker capacity", covers: ["G3"] },
      { id: "B3", name: "Acceptance and operations", covers: ["G5", "G6"] }
    ],
    productionActivationStillRequires: ["G1", "G2", "G3", "G4", "G5", "G6"]
  };
}

async function fetchDocument(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) return null;
  return response.json();
}

async function main() {
  const endpoints = { ...DEFAULT_ENDPOINTS };
  const [operations, success, evidenceStatus, evidenceSchema] = await Promise.all([
    fetchDocument(endpoints.operations),
    fetchDocument(endpoints.success),
    fetchDocument(endpoints.evidenceStatus),
    fetchDocument(endpoints.evidenceSchema)
  ]);

  console.log(JSON.stringify(evaluateProcurement({
    operations,
    success,
    evidenceStatus,
    evidenceSchema
  }), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(JSON.stringify({
      schema: "control12.procurement-evaluation-error/v1",
      error: error.message
    }, null, 2));
    process.exitCode = 1;
  });
}
