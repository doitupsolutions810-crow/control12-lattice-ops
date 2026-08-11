import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProcurement } from "../evaluate.mjs";

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

test("allows procurement while production remains disabled", () => {
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: trust,
    evidenceSchema: trust
  });
  assert.equal(result.procurementDecision, "READY_FOR_PROCUREMENT");
  assert.equal(result.productionDecision, "NO_GO");
});

test("holds procurement when evidence trust cannot be verified", () => {
  const result = evaluateProcurement({ operations, success, evidenceStatus: null, evidenceSchema: null });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.equal(result.productionDecision, "NO_GO");
});

test("does not accept weakened evidence policy", () => {
  const weakened = { ...trust, syntheticEvidenceRejected: false };
  const result = evaluateProcurement({
    operations,
    success,
    evidenceStatus: weakened,
    evidenceSchema: weakened
  });
  assert.equal(result.procurementDecision, "HOLD_EVIDENCE_CONTROL");
  assert.ok(result.trust.mismatches.some(item => item.key === "syntheticEvidenceRejected"));
});
