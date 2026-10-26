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

const STATUS_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema";
const EXPECTED_GATE_IDS = Object.freeze(["G0", "G1", "G2", "G3", "G4", "G5", "G6"]);

function propertyAllows(property, expected) {
  if (!property || typeof property !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(property, "const")) {
    return property.const === expected;
  }
  return Array.isArray(property.enum) && property.enum.includes(expected);
}

function readGateStatuses(statusDocument) {
  const field = ["gates", "gateStatuses", "results"]
    .find(key => Object.prototype.hasOwnProperty.call(statusDocument, key));
  if (!field) return { field: null, entries: null, shape: null };
  const value = statusDocument[field];
  if (Array.isArray(value)) {
    return {
      field,
      shape: "array",
      entries: value.map(item => ({
        id: item && typeof item === "object" ? item.id : undefined,
        status: item && typeof item === "object" ? item.status : undefined
      }))
    };
  }
  if (value && typeof value === "object") {
    return {
      field,
      shape: "object",
      entries: Object.entries(value).map(([id, item]) => ({
        id,
        status: typeof item === "string" ? item : item && typeof item === "object" ? item.status : undefined
      }))
    };
  }
  return { field, entries: null, shape: null };
}

function validGateEntries(gateData) {
  if (!Array.isArray(gateData.entries) ||
      gateData.entries.length !== EXPECTED_TRUST.mandatoryGates) return false;
  const ids = gateData.entries.map(entry => entry.id);
  return ids.every(id => EXPECTED_GATE_IDS.includes(id)) &&
    new Set(ids).size === EXPECTED_GATE_IDS.length &&
    EXPECTED_GATE_IDS.every(id => ids.includes(id)) &&
    gateData.entries.every(entry => entry.status === "READY");
}

/**
 * The status endpoint and its schema must independently satisfy the trust
 * contract. Never merge them before verification; a schema declaration cannot
 * substitute for a missing live status claim, and vice versa.
 */
function verifyTrust(statusDocument, schemaDocument) {
  const mismatches = [];
  const add = (key, expected, actual) => mismatches.push({ key, expected, actual });

  if (!statusDocument || typeof statusDocument !== "object" || Array.isArray(statusDocument)) {
    add("statusDocument", "object", statusDocument);
    return { verified: false, mismatches };
  }
  if (!schemaDocument || typeof schemaDocument !== "object" || Array.isArray(schemaDocument)) {
    add("schemaDocument", "JSON Schema object", schemaDocument);
    return { verified: false, mismatches };
  }

  for (const [key, expected] of Object.entries(EXPECTED_TRUST)) {
    if (statusDocument[key] !== expected) add(`status.${key}`, expected, statusDocument[key]);
  }
  if (statusDocument.overall !== "READY") add("status.overall", "READY", statusDocument.overall);

  const gateData = readGateStatuses(statusDocument);
  if (!gateData.field || !validGateEntries(gateData)) {
    add("status.gates", `exactly the G0-G6 gate set with all statuses READY`, gateData.entries);
  }

  if (schemaDocument.$schema !== STATUS_SCHEMA_URI) {
    add("schema.$schema", STATUS_SCHEMA_URI, schemaDocument.$schema);
  }
  if (schemaDocument.type !== "object") add("schema.type", "object", schemaDocument.type);
  const properties = schemaDocument.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    add("schema.properties", "object", properties);
  } else {
    for (const [key, expected] of Object.entries(EXPECTED_TRUST)) {
      if (!propertyAllows(properties[key], expected)) {
        add(`schema.properties.${key}`, expected, properties[key]);
      }
    }
    if (!propertyAllows(properties.overall, "READY")) {
      add("schema.properties.overall", "must allow READY", properties.overall);
    }
    const gateSchema = gateData.field ? properties[gateData.field] : null;
    if (!gateSchema) {
      add("schema.properties.gates", "matching gate field", gateData.field);
    } else {
      const itemSchema = gateSchema.items;
      const itemProperties = itemSchema?.properties;
      const itemRequired = Array.isArray(itemSchema?.required) ? itemSchema.required : [];
      const itemIdEnum = itemProperties?.id?.enum;
      const exactIdEnum = Array.isArray(itemIdEnum) &&
        itemIdEnum.length === EXPECTED_GATE_IDS.length &&
        EXPECTED_GATE_IDS.every(id => itemIdEnum.includes(id));
      const exactArray = gateSchema.type === "array" &&
        gateSchema.minItems === EXPECTED_TRUST.mandatoryGates &&
        gateSchema.maxItems === EXPECTED_TRUST.mandatoryGates &&
        gateSchema.uniqueItems === true &&
        itemSchema?.type === "object" &&
        itemRequired.includes("id") && itemRequired.includes("status") &&
        exactIdEnum &&
        propertyAllows(itemProperties?.status, "READY");
      const gateProperties = gateSchema.properties;
      const gateRequired = Array.isArray(gateSchema.required) ? gateSchema.required : [];
      const exactObject = gateSchema.type === "object" &&
        gateProperties && Object.keys(gateProperties).length === EXPECTED_TRUST.mandatoryGates &&
        gateRequired.length === EXPECTED_GATE_IDS.length &&
        EXPECTED_GATE_IDS.every(id => gateRequired.includes(id) &&
          gateProperties[id] && (
            propertyAllows(gateProperties[id], "READY") ||
            (propertyAllows(gateProperties[id].properties?.status, "READY") &&
             Array.isArray(gateProperties[id].required) &&
             gateProperties[id].required.includes("status"))
          ));
      if (!exactArray && !exactObject) {
        add("schema.properties.gates", "exactly seven gates constrained to READY", gateSchema);
      }
    }
  }

  const required = schemaDocument.required;
  if (!Array.isArray(required)) {
    add("schema.required", "array", required);
  } else {
    const expectedRequired = [...Object.keys(EXPECTED_TRUST), "overall"];
    if (gateData.field) expectedRequired.push(gateData.field);
    for (const key of expectedRequired) {
      if (!required.includes(key)) add(`schema.required.${key}`, "required", required);
    }
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
