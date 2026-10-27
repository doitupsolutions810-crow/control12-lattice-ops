import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';

const DEFAULT_ENDPOINTS = Object.freeze({
  operations: "https://control12-operations-plane.vercel.app/api/v1/operations/readiness",
  success: "https://control12-success-plane.vercel.app/api/v1/success/live",
  evidenceStatus: "https://control12-evidence-console.vercel.app/api/status",
  evidenceSchema: "https://control12-evidence-console.vercel.app/api/v1/evidence/schema"
});

const EXPECTED_TRUST = Object.freeze({
  version: "5.4.0",
  runtime: "read-only-dynamic",
  privacy: "local-only",
  mandatoryGates: 7,
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: "production-acceptance",
  requiredEnvironment: "production"
});

const STATUS_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema";
const SOURCE_IDENTITY = "control12-evidence-console";
const SOURCE_ATTESTATION_FIELDS = Object.freeze([
  "sourceIdentity", "sourceKeyId", "sourceEvidenceDigest", "sourceSignature"
]);
const EXPECTED_GATE_IDS = Object.freeze(["E0", "E1", "E2", "E3", "E4", "E5", "E6"]);
const MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;
const SOURCE_TIMESTAMP_PATTERN = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:[.][0-9]{1,3})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;


function canonicalJson(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(item => item === undefined ? 'null' : canonicalJson(item)).join(',') + ']';
  }
  if (value && typeof value === "object") {
    return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sourceDigest(statusDocument) {
  const unsigned = { ...statusDocument };
  delete unsigned.sourceEvidenceDigest;
  delete unsigned.sourceSignature;
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

function parseSourceTimestamp(value) {
  if (typeof value !== "string" || !SOURCE_TIMESTAMP_PATTERN.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const datePart = value.slice(0, 10);
  const calendarDate = Date.parse(datePart + "T00:00:00Z");
  if (!Number.isFinite(calendarDate) ||
      new Date(calendarDate).toISOString().slice(0, 10) !== datePart) return NaN;
  return parsed;
}

function verifySignedFreshness(statusDocument, add) {
  const now = Date.now();
  const generated = parseSourceTimestamp(statusDocument.sourceGeneratedAt);
  const expires = parseSourceTimestamp(statusDocument.sourceExpiresAt);
  if (!Number.isFinite(generated) || !Number.isFinite(expires)) {
    add("status.sourceFreshness", "valid source-issued ISO timestamps", {
      sourceGeneratedAt: statusDocument.sourceGeneratedAt,
      sourceExpiresAt: statusDocument.sourceExpiresAt
    });
  } else {
    if (generated > now + MAX_CLOCK_SKEW_MS) add("status.sourceGeneratedAt", "not beyond 30s future skew", statusDocument.sourceGeneratedAt);
    if (now - generated > MAX_EVIDENCE_AGE_MS) add("status.sourceGeneratedAt", "no older than 5 minutes", statusDocument.sourceGeneratedAt);
    if (expires <= now) add("status.sourceExpiresAt", "later than current time", statusDocument.sourceExpiresAt);
    if (expires <= generated || expires - generated > MAX_EVIDENCE_AGE_MS) {
      add("status.sourceExpiresAt", "validity interval <= 5 minutes", statusDocument.sourceExpiresAt);
    }
  }

  if (statusDocument.sourceIdentity !== SOURCE_IDENTITY) {
    add("status.sourceIdentity", SOURCE_IDENTITY, statusDocument.sourceIdentity);
  }
  const keyId = process.env.EVIDENCE_SOURCE_KEY_ID;
  const publicKeyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  if (!keyId || !publicKeyPem) {
    add("sourceSignatureConfiguration", "pinned EVIDENCE_SOURCE_KEY_ID and EVIDENCE_SOURCE_PUBLIC_KEY_PEM", "missing");
    return;
  }
  if (statusDocument.sourceKeyId !== keyId) {
    add("status.sourceKeyId", keyId, statusDocument.sourceKeyId);
  }
  const expectedDigest = sourceDigest(statusDocument);
  if (typeof statusDocument.sourceEvidenceDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(statusDocument.sourceEvidenceDigest) ||
      statusDocument.sourceEvidenceDigest !== expectedDigest) {
    add("status.sourceEvidenceDigest", expectedDigest, statusDocument.sourceEvidenceDigest);
  }
  const signatureText = statusDocument.sourceSignature;
  if (typeof signatureText !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(signatureText)) {
    add("status.sourceSignature", "base64 Ed25519 signature", signatureText);
    return;
  }
  if (statusDocument.sourceEvidenceDigest !== expectedDigest) return;
  try {
    const publicKey = createPublicKey(publicKeyPem);
    const message = [
      statusDocument.sourceIdentity, statusDocument.sourceKeyId,
      statusDocument.sourceGeneratedAt, statusDocument.sourceExpiresAt,
      statusDocument.sourceEvidenceDigest
    ].join("\n");
    const signature = Buffer.from(signatureText, "base64");
    if (signature.toString("base64") !== signatureText ||
        !verifySignature(null, Buffer.from(message), publicKey, signature)) {
      add("status.sourceSignature", "valid signature under pinned source key", "invalid");
    }
  } catch {
    add("status.sourceSignature", "valid signature under pinned source key", "invalid");
  }
}

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

function schemaRequiresExactGateCoverage(gateSchema) {
  const allOf = gateSchema?.allOf;
  if (!Array.isArray(allOf) || allOf.length !== EXPECTED_GATE_IDS.length) return false;
  return EXPECTED_GATE_IDS.every(gateId => allOf.some(rule => {
    const containsSchema = rule?.contains;
    const required = Array.isArray(containsSchema?.required) ? containsSchema.required : [];
    return containsSchema?.properties?.id?.const === gateId &&
      required.includes("id") &&
      rule.minContains === 1 &&
      rule.maxContains === 1;
  }));
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
    add("status.gates", `exactly the E0-E6 evidence-console contract-check set with all statuses READY`, gateData.entries);
  }
  verifySignedFreshness(statusDocument, add);

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
    if (!propertyAllows(properties.sourceIdentity, SOURCE_IDENTITY)) {
      add("schema.properties.sourceIdentity", SOURCE_IDENTITY, properties.sourceIdentity);
    }
    const keyId = process.env.EVIDENCE_SOURCE_KEY_ID;
    const publicKeyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
    if (!keyId || !publicKeyPem) {
      add("sourceSignatureConfiguration", "pinned EVIDENCE_SOURCE_KEY_ID and EVIDENCE_SOURCE_PUBLIC_KEY_PEM", "missing");
    }
    if (!keyId || !propertyAllows(properties.sourceKeyId, keyId)) {
      add("schema.properties.sourceKeyId", "const pinned source key ID", properties.sourceKeyId);
    }
    const digestSchema = properties.sourceEvidenceDigest;
    if (!digestSchema || digestSchema.type !== "string" || digestSchema.pattern !== "^[a-f0-9]{64}$") {
      add("schema.properties.sourceEvidenceDigest", "SHA-256 hex digest pattern", digestSchema);
    }
    const signatureSchema = properties.sourceSignature;
    if (!signatureSchema || signatureSchema.type !== "string" ||
        signatureSchema.pattern !== "^[A-Za-z0-9+/]{86}==$") {
      add("schema.properties.sourceSignature", "Ed25519 base64 signature pattern", signatureSchema);
    }
    for (const key of ["sourceGeneratedAt", "sourceExpiresAt"]) {
      const rule = properties[key];
      if (!rule || rule.type !== "string" || rule.format !== "date-time") {
        add(`schema.properties.${key}`, "date-time string", rule);
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
        propertyAllows(itemProperties?.status, "READY") &&
        schemaRequiresExactGateCoverage(gateSchema);
      const gateProperties = gateSchema.properties;
      const gateRequired = Array.isArray(gateSchema.required) ? gateSchema.required : [];
      const exactObject = gateSchema.type === "object" &&
        gateSchema.additionalProperties === false &&
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
    const expectedRequired = [...Object.keys(EXPECTED_TRUST), ...SOURCE_ATTESTATION_FIELDS, "sourceGeneratedAt", "sourceExpiresAt", "overall"];
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

export async function fetchDocument(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 20000
} = {}) {
  const requestedUrl = new URL(url);
  if (requestedUrl.protocol !== "https:") {
    throw new TypeError("Control12 public evidence endpoints must use HTTPS.");
  }
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    headers: { accept: "application/json", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const finalUrl = response.url ? new URL(response.url) : requestedUrl;
  if (
    finalUrl.protocol !== "https:" ||
    finalUrl.origin !== requestedUrl.origin ||
    finalUrl.pathname !== requestedUrl.pathname ||
    finalUrl.search !== requestedUrl.search
  ) {
    throw new Error("Control12 evidence response escaped its requested HTTPS URL.");
  }
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
