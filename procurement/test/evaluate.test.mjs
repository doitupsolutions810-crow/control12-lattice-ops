import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { evaluateProcurement, fetchDocument } from "../evaluate.mjs";

const trust = {
  version: "5.4.0",
  runtime: "read-only-dynamic",
  privacy: "local-only",
  mandatoryGates: 7,
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: "production-acceptance",
  requiredEnvironment: "production"
};

const operations = {
  phase: "ACTIVATION_REQUIRED",
  operational: false,
  components: [{ name: "provider-telemetry", ready: true }]
};

const success = {
  decision: "NO_GO",
  score: 15,
  results: [{ id: "G0", status: "PASS" }]
};

const gateIds = ["E0", "E1", "E2", "E3", "E4", "E5", "E6"];
const oldKeyId = process.env.EVIDENCE_SOURCE_KEY_ID;
const oldPublicKeyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
const { publicKey: fixturePublicKey, privateKey: fixturePrivateKey } = generateKeyPairSync("ed25519");
const fixturePublicKeyPem = fixturePublicKey.export({ type: "spki", format: "pem" });
process.env.EVIDENCE_SOURCE_KEY_ID = "fixture-key-1";
process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = fixturePublicKeyPem;
test.after(() => {
  if (oldKeyId === undefined) delete process.env.EVIDENCE_SOURCE_KEY_ID;
  else process.env.EVIDENCE_SOURCE_KEY_ID = oldKeyId;
  if (oldPublicKeyPem === undefined) delete process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  else process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = oldPublicKeyPem;
});

function canonicalJson(value) {
  if (Array.isArray(value)) return "[" + value.map(item => item === undefined ? "null" : canonicalJson(item)).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function signStatus(value) {
  delete value.sourceEvidenceDigest;
  delete value.sourceSignature;
  value.sourceEvidenceDigest = createHash("sha256").update(canonicalJson(value)).digest("hex");
  const message = [
    value.sourceIdentity, value.sourceKeyId, value.sourceGeneratedAt,
    value.sourceExpiresAt, value.sourceEvidenceDigest
  ].join("\n");
  value.sourceSignature = sign(null, Buffer.from(message), fixturePrivateKey).toString("base64");
  return value;
}

function goodStatus(overrides = {}) {
  return signStatus({
    ...trust,
    sourceIdentity: "control12-evidence-console",
    sourceKeyId: "fixture-key-1",
    sourceGeneratedAt: new Date().toISOString(),
    sourceExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    overall: "READY",
    gates: Object.fromEntries(gateIds.map(id => [id, "READY"])),
    ...overrides
  });
}

const status = goodStatus();
const evidenceSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [...Object.keys(trust), "sourceIdentity", "sourceKeyId", "sourceEvidenceDigest", "sourceSignature", "sourceGeneratedAt", "sourceExpiresAt", "overall", "gates"],
  properties: {
    ...Object.fromEntries(Object.entries(trust).map(([key, value]) => [key, { const: value }])),
    sourceIdentity: { const: "control12-evidence-console" },
    sourceKeyId: { const: "fixture-key-1" },
    sourceEvidenceDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
    sourceSignature: { type: "string", pattern: "^[A-Za-z0-9+/]{86}==$" },
    sourceGeneratedAt: { type: "string", format: "date-time" },
    sourceExpiresAt: { type: "string", format: "date-time" },
    overall: { const: "READY" },
    gates: {
      type: "object",
      required: [...gateIds],
      additionalProperties: false,
      properties: Object.fromEntries(gateIds.map(id => [id, { const: "READY" }]))
    }
  }
};


test("a widened enum or unknown contract property blocks procurement", () => {
  const widened = structuredClone(evidenceSchema);
  widened.properties.syntheticEvidenceRejected = { enum: [true, false] };
  const widenedResult = evaluateProcurement({ operations, success, evidenceStatus: status, evidenceSchema: widened });
  assert.equal(widenedResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(widenedResult.trust.mismatches.some(item => item.key === "schema.properties.syntheticEvidenceRejected"));

  const weakOverall = structuredClone(evidenceSchema);
  weakOverall.properties.overall = { enum: ["READY", "HOLD"] };
  const weakOverallResult = evaluateProcurement({ operations, success, evidenceStatus: status, evidenceSchema: weakOverall });
  assert.equal(weakOverallResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(weakOverallResult.trust.mismatches.some(item => item.key === "schema.properties.overall"));

  const extra = structuredClone(evidenceSchema);
  extra.properties.operatorNote = { type: "string" };
  const extraResult = evaluateProcurement({ operations, success, evidenceStatus: status, evidenceSchema: extra });
  assert.equal(extraResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(extraResult.trust.mismatches.some(item => item.key === "schema.properties"));
});

test("extra signed status fields and open gate-item schemas are rejected", () => {
  const extraStatus = signStatus({ ...status, operatorNote: "unexpected" });
  const extraStatusResult = evaluateProcurement({ operations, success, evidenceStatus: extraStatus, evidenceSchema });
  assert.equal(extraStatusResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(extraStatusResult.trust.mismatches.some(item => item.key === "status.fields"));

  const openItems = structuredClone(evidenceSchema);
  openItems.properties.gates = {
    type: "array", minItems: 7, maxItems: 7, uniqueItems: true,
    allOf: gateIds.map(id => ({
      contains: { type: "object", required: ["id"], properties: { id: { const: id } } },
      minContains: 1, maxContains: 1
    })),
    items: {
      type: "object", additionalProperties: true, required: ["id", "status"],
      properties: { id: { enum: [...gateIds] }, status: { const: "READY" } }
    }
  };
  const openItemsResult = evaluateProcurement({ operations, success, evidenceStatus: {
    ...status, gates: gateIds.map(id => ({ id, status: "READY" }))
  }, evidenceSchema: openItems });
  assert.equal(openItemsResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(openItemsResult.trust.mismatches.some(item => item.key === "schema.properties.gates"));
});

test("status payload mutation after signing is rejected", () => {
  const modified = { ...status, privacy: "remote-storage" };
  const result = evaluateProcurement({ operations, success, evidenceStatus: modified, evidenceSchema });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "status.sourceEvidenceDigest"));
});

test("fresh-looking schema cannot compensate for stale signed source evidence", () => {
  const stale = goodStatus({
    sourceGeneratedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    sourceExpiresAt: new Date(Date.now() + 30_000).toISOString()
  });
  const result = evaluateProcurement({ operations, success, evidenceStatus: stale, evidenceSchema });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "status.sourceGeneratedAt"));
});

test("missing pinned source key configuration fails closed", () => {
  const keyId = process.env.EVIDENCE_SOURCE_KEY_ID;
  const keyPem = process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  delete process.env.EVIDENCE_SOURCE_KEY_ID;
  delete process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  try {
    const result = evaluateProcurement({ operations, success, evidenceStatus: goodStatus(), evidenceSchema });
    assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
    assert.ok(result.trust.mismatches.some(item => item.key === "sourceSignatureConfiguration"));
  } finally {
    process.env.EVIDENCE_SOURCE_KEY_ID = keyId;
    process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = keyPem;
  }
});

test("weak or absent schema signature fields block procurement", () => {
  const weak = structuredClone(evidenceSchema);
  weak.properties.sourceSignature = { type: "string" };
  const weakResult = evaluateProcurement({ operations, success, evidenceStatus: status, evidenceSchema: weak });
  assert.equal(weakResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(weakResult.trust.mismatches.some(item => item.key === "schema.properties.sourceSignature"));

  const missing = structuredClone(evidenceSchema);
  missing.required = missing.required.filter(key => key !== "sourceEvidenceDigest");
  const missingResult = evaluateProcurement({ operations, success, evidenceStatus: status, evidenceSchema: missing });
  assert.equal(missingResult.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(missingResult.trust.mismatches.some(item => item.key === "schema.required.sourceEvidenceDigest"));
});

test("evidence-console contract checks use E0-E6 and do not replace production G0-G6", () => {
  assert.deepEqual(Object.keys(status.gates).sort(), [...gateIds].sort());
  assert.equal(success.results[0].id, "G0");
  assert.equal(evaluateProcurement({ operations, success, evidenceStatus: status, evidenceSchema }).productionDecision, "NO_GO");
});

test("allows procurement while production remains disabled with paired valid trust documents", () => {
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: status,
    evidenceSchema
  });
  assert.equal(result.procurementDecision, "READY_FOR_PROCUREMENT");
  assert.equal(result.productionDecision, "NO_GO");
  assert.equal(result.trust.verified, true);
});

test("holds procurement when either evidence endpoint is unavailable", () => {
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: null,
    evidenceSchema: null
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.equal(result.productionDecision, "NO_GO");
});

test("does not accept weakened live evidence policy", () => {
  const weakened = { ...status, syntheticEvidenceRejected: false };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: weakened,
    evidenceSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "status.syntheticEvidenceRejected"));
});

test("a schema claim cannot fill a missing status claim", () => {
  const missingStatusClaim = { ...status };
  delete missingStatusClaim.syntheticEvidenceRejected;
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: missingStatusClaim,
    evidenceSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "status.syntheticEvidenceRejected"));
});

test("a live status claim cannot compensate for a weakened schema", () => {
  const weakenedSchema = {
    ...evidenceSchema,
    properties: {
      ...evidenceSchema.properties,
      syntheticEvidenceRejected: { type: "boolean" }
    }
  };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: status,
    evidenceSchema: weakenedSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "schema.properties.syntheticEvidenceRejected"));
});

test("procurement holds if any live gate is not READY", () => {
  const oneGateHeld = { ...status, gates: { ...status.gates, E6: "HOLD" } };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: oneGateHeld,
    evidenceSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "status.gates"));
});

test("production remains NO_GO even when trust and procurement checks pass", () => {
  const result = evaluateProcurement({
    operations,
    success: { ...success, decision: "GO" },
    evidenceStatus: status,
    evidenceSchema
  });
  assert.equal(result.procurementDecision, "READY_FOR_PROCUREMENT");
  assert.equal(result.productionDecision, "NO_GO");
});

test("schema must require every gate key, not merely describe each property", () => {
  const incompleteSchema = structuredClone(evidenceSchema);
  incompleteSchema.properties.gates.required = gateIds.slice(0, 6);
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: status,
    evidenceSchema: incompleteSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "schema.properties.gates"));
});

test("duplicate or unknown live gate IDs block procurement", () => {
  const duplicated = {
    ...status,
    gates: { E0: "READY", E1: "READY", E2: "READY", E3: "READY", E4: "READY", E5: "READY", E7: "READY" }
  };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: duplicated,
    evidenceSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "status.gates"));
});

test("array schema requires one occurrence of every E0-E6 gate ID", () => {
  const arrayStatus = {
    ...status,
    gates: gateIds.map(id => ({ id, status: "READY" }))
  };
  const arraySchema = structuredClone(evidenceSchema);
  arraySchema.properties.gates = {
    type: "array",
    minItems: 7,
    maxItems: 7,
    uniqueItems: true,
    allOf: gateIds.map(id => ({
      contains: { type: "object", required: ["id"], properties: { id: { const: id } } },
      minContains: 1,
      maxContains: 1
    })),
    items: {
      type: "object",
      additionalProperties: false,
      required: ["id", "status"],
      properties: {
        id: { enum: [...gateIds] },
        status: { const: "READY" }
      }
    }
  };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: arrayStatus,
    evidenceSchema: arraySchema
  });
  assert.equal(result.procurementDecision, "READY_FOR_PROCUREMENT");
  assert.equal(result.trust.verified, true);
});

test("array schema missing a gate-specific occurrence constraint holds procurement", () => {
  const arrayStatus = {
    ...status,
    gates: gateIds.map(id => ({ id, status: "READY" }))
  };
  const arraySchema = structuredClone(evidenceSchema);
  arraySchema.properties.gates = {
    type: "array",
    minItems: 7,
    maxItems: 7,
    uniqueItems: true,
    allOf: gateIds.slice(0, 6).map(id => ({
      contains: { type: "object", required: ["id"], properties: { id: { const: id } } },
      minContains: 1,
      maxContains: 1
    })),
    items: {
      type: "object",
      additionalProperties: false,
      required: ["id", "status"],
      properties: {
        id: { enum: [...gateIds] },
        status: { const: "READY" }
      }
    }
  };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: arrayStatus,
    evidenceSchema: arraySchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "schema.properties.gates"));
});


test("evidence fetches refuse redirects and request uncached JSON", async () => {
  let observed = null;
  const value = await fetchDocument("https://example.invalid/api/status", {
    fetchImpl: async (url, options) => {
      observed = { url: String(url), options };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });
  assert.deepEqual(value, { ok: true });
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.options.cache, "no-store");
  assert.equal(observed.options.headers["cache-control"], "no-cache");
});

test("evidence fetch rejects non-HTTPS endpoints before I/O", async () => {
  let calls = 0;
  await assert.rejects(
    fetchDocument("http://example.invalid/api/status", {
      fetchImpl: async () => { calls++; return new Response("{}", { status: 200 }); }
    }),
    /must use HTTPS/
  );
  assert.equal(calls, 0);
});

test("evidence fetch rejects cross-origin final response URLs", async () => {
  await assert.rejects(
    fetchDocument("https://example.invalid/api/status", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: "https://attacker.invalid/api/status",
        json: async () => ({ ok: true })
      })
    }),
    /escaped its requested HTTPS URL/
  );
});

test("object gate schema cannot permit additional gate IDs", () => {
  const openSchema = structuredClone(evidenceSchema);
  openSchema.properties.gates.additionalProperties = true;
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: status,
    evidenceSchema: openSchema
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "schema.properties.gates"));
});
