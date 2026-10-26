import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProcurement, fetchDocument } from "../evaluate.mjs";

const trust = {
  version: "5.3.1",
  runtime: "static",
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

const gateIds = ["G0", "G1", "G2", "G3", "G4", "G5", "G6"];
const status = {
  ...trust,
  overall: "READY",
  gates: Object.fromEntries(gateIds.map(id => [id, "READY"]))
};
const evidenceSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [...Object.keys(trust), "overall", "gates"],
  properties: {
    ...Object.fromEntries(Object.entries(trust).map(([key, value]) => [key, { const: value }])),
    overall: { enum: ["READY", "HOLD"] },
    gates: {
      type: "object",
      required: [...gateIds],
      additionalProperties: false,
      properties: Object.fromEntries(gateIds.map(id => [id, { const: "READY" }]))
    }
  }
};

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
  const oneGateHeld = { ...status, gates: { ...status.gates, G6: "HOLD" } };
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
    gates: { G0: "READY", G1: "READY", G2: "READY", G3: "READY", G4: "READY", G5: "READY", G7: "READY" }
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

test("array schema requires one occurrence of every G0-G6 gate ID", () => {
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
