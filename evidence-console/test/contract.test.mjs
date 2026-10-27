import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import statusHandler from "../api/status.js";
import schemaHandler from "../api/v1/evidence/schema.js";
import {
  buildEvidenceSchema,
  buildEvidenceStatus,
  sourceDigest,
  verifyEvidenceStatus,
  verifyEvidenceSchema,
  CHECK_IDS,
  EVIDENCE_CONTRACT
} from "../lib/contract.mjs";

const oldEnv = {
  keyId: process.env.EVIDENCE_SOURCE_KEY_ID,
  privateKey: process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM,
  publicKey: process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM
};
const pair = generateKeyPairSync("ed25519");
const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
const publicPem = pair.publicKey.export({ type: "spki", format: "pem" });
const fixtureEnv = {
  ...process.env,
  EVIDENCE_SOURCE_KEY_ID: "fixture-key-1",
  EVIDENCE_SOURCE_PRIVATE_KEY_PEM: privatePem,
  EVIDENCE_SOURCE_PUBLIC_KEY_PEM: publicPem
};
process.env.EVIDENCE_SOURCE_KEY_ID = fixtureEnv.EVIDENCE_SOURCE_KEY_ID;
process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM = fixtureEnv.EVIDENCE_SOURCE_PRIVATE_KEY_PEM;
process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = fixtureEnv.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;

test.after(() => {
  if (oldEnv.keyId === undefined) delete process.env.EVIDENCE_SOURCE_KEY_ID;
  else process.env.EVIDENCE_SOURCE_KEY_ID = oldEnv.keyId;
  if (oldEnv.privateKey === undefined) delete process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM;
  else process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM = oldEnv.privateKey;
  if (oldEnv.publicKey === undefined) delete process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM;
  else process.env.EVIDENCE_SOURCE_PUBLIC_KEY_PEM = oldEnv.publicKey;
});

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test("builds a signed, fresh v5.4.0 status with a schema-bound E0-E6 contract", () => {
  const status = buildEvidenceStatus({ env: fixtureEnv });
  const schema = buildEvidenceSchema(fixtureEnv);
  assert.equal(status.version, "5.4.0");
  assert.equal(status.runtime, "read-only-dynamic");
  assert.equal(status.overall, "READY");
  assert.deepEqual(status.gates.map(gate => gate.id), [...CHECK_IDS]);
  assert.equal(status.gates.every(gate => gate.status === "READY"), true);
  assert.equal(status.sourceIdentity, "control12-evidence-console");
  assert.equal(status.sourceKeyId, "fixture-key-1");
  assert.equal(status.sourceEvidenceDigest, sourceDigest(status));
  assert.equal(verifyEvidenceStatus(status, { env: fixtureEnv }).valid, true);
  assert.equal(schema.properties.sourceKeyId.const, "fixture-key-1");
  assert.equal(schema.properties.gates.maxItems, 7);
  assert.deepEqual(CHECK_IDS, ["E0", "E1", "E2", "E3", "E4", "E5", "E6"]);
  assert.equal(EVIDENCE_CONTRACT.serverSideEvidenceStorage, false);
});

test("the producer schema independently enforces every source trust field", () => {
  const schema = buildEvidenceSchema(fixtureEnv);
  assert.equal(verifyEvidenceSchema(schema, { env: fixtureEnv }).valid, true);
  const weakened = structuredClone(schema);
  weakened.properties.sourceSignature = { type: "string" };
  const result = verifyEvidenceSchema(weakened, { env: fixtureEnv });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes("schema_signature_rule_invalid"));
});

test("producer schema rejects widened or extra fields and open gate-item schemas", () => {
  const schema = buildEvidenceSchema(fixtureEnv);

  const extraProperty = structuredClone(schema);
  extraProperty.properties.operatorNote = { type: "string" };
  const extraPropertyResult = verifyEvidenceSchema(extraProperty, { env: fixtureEnv });
  assert.equal(extraPropertyResult.valid, false);
  assert.ok(extraPropertyResult.failures.includes("schema_properties_not_exact"));

  const duplicateRequired = structuredClone(schema);
  duplicateRequired.required.push("sourceSignature");
  const duplicateRequiredResult = verifyEvidenceSchema(duplicateRequired, { env: fixtureEnv });
  assert.equal(duplicateRequiredResult.valid, false);
  assert.ok(duplicateRequiredResult.failures.includes("schema_required_fields_invalid"));

  const openItems = structuredClone(schema);
  openItems.properties.gates.items.additionalProperties = true;
  const openItemsResult = verifyEvidenceSchema(openItems, { env: fixtureEnv });
  assert.equal(openItemsResult.valid, false);
  assert.ok(openItemsResult.failures.includes("schema_contract_check_gate_rules_invalid"));
});

test("producer status verifier rejects properties outside the signed contract", () => {
  const status = buildEvidenceStatus({ env: fixtureEnv });
  status.operatorNote = "not in the v5.4.0 contract";
  const result = verifyEvidenceStatus(status, { env: fixtureEnv });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes("status_fields_not_exact"));
});

test("producer rejects timezone-free and impossible source timestamps", () => {
  const status = buildEvidenceStatus({ env: fixtureEnv });
  status.sourceGeneratedAt = "2026-10-27T00:00:00";
  assert.ok(verifyEvidenceStatus(status, { env: fixtureEnv }).failures.includes("freshness_timestamps_invalid"));
  const impossible = buildEvidenceStatus({ env: fixtureEnv });
  impossible.sourceGeneratedAt = "2026-02-30T00:00:00Z";
  assert.ok(verifyEvidenceStatus(impossible, { env: fixtureEnv }).failures.includes("freshness_timestamps_invalid"));
});

test("rejects a status mutation that is not re-digested and re-signed", () => {
  const status = buildEvidenceStatus({ env: fixtureEnv });
  status.privacy = "remote-storage";
  const result = verifyEvidenceStatus(status, { env: fixtureEnv });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes("source_digest_mismatch"));
});

test("rejects expired and stale source-issued status even when its signature is valid", () => {
  const now = Date.now();
  const oldStatus = buildEvidenceStatus({ env: fixtureEnv, now: now - 6 * 60 * 1000 });
  const result = verifyEvidenceStatus(oldStatus, { env: fixtureEnv, now });
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes("source_evidence_stale"));
  assert.ok(result.failures.includes("source_evidence_expired"));
});

test("missing or mismatched signing material fails closed", () => {
  const missing = { ...fixtureEnv };
  delete missing.EVIDENCE_SOURCE_PRIVATE_KEY_PEM;
  assert.throws(() => buildEvidenceStatus({ env: missing }), /configuration_invalid/);

  const other = generateKeyPairSync("ed25519");
  const mismatched = {
    ...fixtureEnv,
    EVIDENCE_SOURCE_PUBLIC_KEY_PEM: other.publicKey.export({ type: "spki", format: "pem" })
  };
  assert.throws(() => buildEvidenceStatus({ env: mismatched }), /key_pair_mismatch/);
});

test("status API rejects writes and does not issue authority when signer configuration is absent", () => {
  const nonGet = mockResponse();
  statusHandler({ method: "POST" }, nonGet);
  assert.equal(nonGet.statusCode, 405);
  assert.equal(nonGet.headers.Allow, "GET");

  const savedPrivateKey = process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM;
  delete process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM;
  try {
    const unavailable = mockResponse();
    statusHandler({ method: "GET" }, unavailable);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.body.authority, "none");
  } finally {
    process.env.EVIDENCE_SOURCE_PRIVATE_KEY_PEM = savedPrivateKey;
  }
});

test("schema API is read-only and advertises the independently pinned key", () => {
  const response = mockResponse();
  schemaHandler({ method: "GET" }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.properties.sourceIdentity.const, "control12-evidence-console");
  assert.equal(response.body.properties.sourceKeyId.const, "fixture-key-1");

  const denied = mockResponse();
  schemaHandler({ method: "POST" }, denied);
  assert.equal(denied.statusCode, 405);
});
