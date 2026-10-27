import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify
} from "node:crypto";

export const EVIDENCE_CONTRACT = Object.freeze({
  version: "5.4.0",
  runtime: "read-only-dynamic",
  privacy: "local-only",
  serverSideEvidenceStorage: false,
  syntheticEvidenceRejected: true,
  productionEvidenceClassRequired: true,
  requiredEvidenceClass: "production-acceptance",
  requiredEnvironment: "production",
  mandatoryGates: 7
});

export const SOURCE_IDENTITY = "control12-evidence-console";
export const CHECK_IDS = Object.freeze(["E0", "E1", "E2", "E3", "E4", "E5", "E6"]);
export const MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
export const MAX_CLOCK_SKEW_MS = 30 * 1000;
const SIGNATURE_PATTERN = "^[A-Za-z0-9+/]{86}==$";
const DIGEST_PATTERN = "^[a-f0-9]{64}$";
const SOURCE_TIMESTAMP_PATTERN = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:[.][0-9]{1,3})?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/;

function parseSourceTimestamp(value) {
  if (typeof value !== "string" || !SOURCE_TIMESTAMP_PATTERN.test(value)) return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const datePart = value.slice(0, 10);
  const day = Date.parse(datePart + "T00:00:00Z");
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== datePart) return NaN;
  return parsed;
}

function requireString(env, name, pattern = null) {
  const value = typeof env[name] === "string" ? env[name].trim() : "";
  if (!value || (pattern && !pattern.test(value))) {
    throw new Error("evidence_source_configuration_invalid");
  }
  return value;
}

function signingMaterials(env = process.env) {
  const keyId = requireString(env, "EVIDENCE_SOURCE_KEY_ID", /^[A-Za-z0-9._:-]{1,128}$/);
  const privatePem = requireString(env, "EVIDENCE_SOURCE_PRIVATE_KEY_PEM");
  const publicPem = requireString(env, "EVIDENCE_SOURCE_PUBLIC_KEY_PEM");
  let privateKey;
  let publicKey;
  try {
    privateKey = createPrivateKey(privatePem);
    publicKey = createPublicKey(publicPem);
  } catch {
    throw new Error("evidence_source_key_material_invalid");
  }
  if (privateKey.asymmetricKeyType !== "ed25519" ||
      publicKey.asymmetricKeyType !== "ed25519") {
    throw new Error("evidence_source_key_type_invalid");
  }
  const derived = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const configured = publicKey.export({ type: "spki", format: "der" });
  if (!derived.equals(configured)) {
    throw new Error("evidence_source_key_pair_mismatch");
  }
  return { keyId, privateKey, publicKey };
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(item => item === undefined ? "null" : canonicalJson(item)).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return "{" + Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => JSON.stringify(key) + ":" + canonicalJson(value[key]))
      .join(",") + "}";
  }
  return JSON.stringify(value);
}

export function sourceDigest(statusDocument) {
  const unsigned = { ...statusDocument };
  delete unsigned.sourceEvidenceDigest;
  delete unsigned.sourceSignature;
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

export function sourceSignatureMessage(statusDocument) {
  return [
    statusDocument.sourceIdentity,
    statusDocument.sourceKeyId,
    statusDocument.sourceGeneratedAt,
    statusDocument.sourceExpiresAt,
    statusDocument.sourceEvidenceDigest
  ].join("\n");
}

export function buildEvidenceSchema(env = process.env) {
  const { keyId } = signingMaterials(env);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: [
      ...Object.keys(EVIDENCE_CONTRACT),
      "sourceIdentity", "sourceKeyId", "sourceEvidenceDigest", "sourceSignature",
      "sourceGeneratedAt", "sourceExpiresAt", "overall", "gates"
    ],
    properties: {
      ...Object.fromEntries(Object.entries(EVIDENCE_CONTRACT).map(([key, value]) => [key, { const: value }])),
      sourceIdentity: { const: SOURCE_IDENTITY },
      sourceKeyId: { const: keyId },
      sourceEvidenceDigest: { type: "string", pattern: DIGEST_PATTERN },
      sourceSignature: { type: "string", pattern: SIGNATURE_PATTERN },
      sourceGeneratedAt: { type: "string", format: "date-time" },
      sourceExpiresAt: { type: "string", format: "date-time" },
      overall: { const: "READY" },
      gates: {
        type: "array",
        minItems: 7,
        maxItems: 7,
        uniqueItems: true,
        allOf: CHECK_IDS.map(id => ({
          contains: { type: "object", required: ["id"], properties: { id: { const: id } } },
          minContains: 1,
          maxContains: 1
        })),
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "status"],
          properties: {
            id: { enum: [...CHECK_IDS] },
            status: { const: "READY" }
          }
        }
      }
    }
  };
}

export function verifyEvidenceSchema(schema, { env = process.env } = {}) {
  const failures = [];
  let keyId;
  try {
    ({ keyId } = signingMaterials(env));
  } catch {
    return { valid: false, failures: ["source_signing_configuration_invalid"] };
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { valid: false, failures: ["schema_not_object"] };
  }
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema" ||
      schema.type !== "object" || schema.additionalProperties !== false) {
    failures.push("schema_root_contract_invalid");
  }
  const properties = schema.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return { valid: false, failures: [...failures, "schema_properties_invalid"] };
  }
  for (const [key, value] of Object.entries(EVIDENCE_CONTRACT)) {
    if (properties[key]?.const !== value) failures.push("schema_contract_field_invalid:" + key);
  }
  if (properties.sourceIdentity?.const !== SOURCE_IDENTITY) failures.push("schema_source_identity_invalid");
  if (properties.sourceKeyId?.const !== keyId) failures.push("schema_source_key_id_invalid");
  if (properties.sourceEvidenceDigest?.type !== "string" ||
      properties.sourceEvidenceDigest.pattern !== DIGEST_PATTERN) failures.push("schema_digest_rule_invalid");
  if (properties.sourceSignature?.type !== "string" ||
      properties.sourceSignature.pattern !== SIGNATURE_PATTERN) failures.push("schema_signature_rule_invalid");
  for (const key of ["sourceGeneratedAt", "sourceExpiresAt"]) {
    if (properties[key]?.type !== "string" || properties[key].format !== "date-time") {
      failures.push("schema_timestamp_rule_invalid:" + key);
    }
  }
  if (properties.overall?.const !== "READY") failures.push("schema_overall_rule_invalid");
  const gates = properties.gates;
  const expectedFields = [
    ...Object.keys(EVIDENCE_CONTRACT), "sourceIdentity", "sourceKeyId", "sourceEvidenceDigest",
    "sourceSignature", "sourceGeneratedAt", "sourceExpiresAt", "overall", "gates"
  ];
  const expectedFieldSet = new Set(expectedFields);
  if (Object.keys(properties).length !== expectedFieldSet.size ||
      !Object.keys(properties).every(key => expectedFieldSet.has(key))) {
    failures.push("schema_properties_not_exact");
  }
  if (!Array.isArray(schema.required) ||
      schema.required.length !== expectedFieldSet.size ||
      new Set(schema.required).size !== schema.required.length ||
      !schema.required.every(key => expectedFieldSet.has(key))) {
    failures.push("schema_required_fields_invalid");
  }
  if (!gates || gates.type !== "array" || gates.minItems !== 7 || gates.maxItems !== 7 ||
      gates.uniqueItems !== true || !gates.items || gates.items.type !== "object" ||
      gates.items.additionalProperties !== false ||
      !Array.isArray(gates.items.required) || gates.items.required.length !== 2 ||
      new Set(gates.items.required).size !== 2 ||
      !gates.items.required.includes("id") || !gates.items.required.includes("status") ||
      !gates.items.properties || Object.keys(gates.items.properties).length !== 2 ||
      !Object.prototype.hasOwnProperty.call(gates.items.properties, "id") ||
      !Object.prototype.hasOwnProperty.call(gates.items.properties, "status") ||
      !Array.isArray(gates.items.properties?.id?.enum) ||
      gates.items.properties.id.enum.length !== CHECK_IDS.length ||
      !CHECK_IDS.every(id => gates.items.properties.id.enum.includes(id)) ||
      gates.items.properties?.status?.const !== "READY" ||
      !Array.isArray(gates.allOf) || gates.allOf.length !== CHECK_IDS.length ||
      !CHECK_IDS.every(id => gates.allOf.some(rule =>
        rule?.contains?.properties?.id?.const === id &&
        Array.isArray(rule.contains.required) && rule.contains.required.includes("id") &&
        rule.minContains === 1 && rule.maxContains === 1))) {
    failures.push("schema_contract_check_gate_rules_invalid");
  }
  return { valid: failures.length === 0, failures };
}

export function verifyEvidenceStatus(status, { env = process.env, now = Date.now() } = {}) {
  const failures = [];
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    return { valid: false, failures: ["status_not_object"] };
  }
  const expectedFields = [
    ...Object.keys(EVIDENCE_CONTRACT), "sourceIdentity", "sourceKeyId", "sourceEvidenceDigest",
    "sourceSignature", "sourceGeneratedAt", "sourceExpiresAt", "overall", "gates"
  ];
  const expectedFieldSet = new Set(expectedFields);
  const statusFields = Object.keys(status);
  if (statusFields.length !== expectedFieldSet.size ||
      !statusFields.every(key => expectedFieldSet.has(key))) {
    failures.push("status_fields_not_exact");
  }
  for (const [key, expected] of Object.entries(EVIDENCE_CONTRACT)) {
    if (status[key] !== expected) failures.push("status_contract_field_mismatch:" + key);
  }
  if (status.overall !== "READY") failures.push("status_overall_not_ready");
  const gates = Array.isArray(status.gates) ? status.gates : [];
  const ids = gates.map(gate => gate?.id);
  if (gates.length !== CHECK_IDS.length ||
      new Set(ids).size !== CHECK_IDS.length ||
      !CHECK_IDS.every(id => ids.includes(id)) ||
      gates.some(gate => !gate || typeof gate !== "object" || Array.isArray(gate) ||
        Object.keys(gate).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(gate, "id") ||
        !Object.prototype.hasOwnProperty.call(gate, "status") || gate.status !== "READY")) {
    failures.push("status_contract_check_gates_invalid");
  }
  const generated = parseSourceTimestamp(status.sourceGeneratedAt);
  const expires = parseSourceTimestamp(status.sourceExpiresAt);
  if (!Number.isFinite(generated) || !Number.isFinite(expires)) {
    failures.push("freshness_timestamps_invalid");
  } else {
    if (generated > now + MAX_CLOCK_SKEW_MS) failures.push("source_generated_in_future");
    if (now - generated > MAX_EVIDENCE_AGE_MS) failures.push("source_evidence_stale");
    if (expires <= now) failures.push("source_evidence_expired");
    if (expires <= generated || expires - generated > MAX_EVIDENCE_AGE_MS) failures.push("source_lifetime_invalid");
  }
  let materials;
  try {
    materials = signingMaterials(env);
  } catch {
    return { valid: false, failures: [...failures, "source_signing_configuration_invalid"] };
  }
  if (status.sourceIdentity !== SOURCE_IDENTITY) failures.push("source_identity_mismatch");
  if (status.sourceKeyId !== materials.keyId) failures.push("source_key_id_mismatch");
  const digest = sourceDigest(status);
  if (status.sourceEvidenceDigest !== digest) failures.push("source_digest_mismatch");
  if (typeof status.sourceSignature !== "string" || !new RegExp(SIGNATURE_PATTERN).test(status.sourceSignature)) {
    failures.push("source_signature_malformed");
  } else if (status.sourceEvidenceDigest === digest) {
    try {
      const signature = Buffer.from(status.sourceSignature, "base64");
      if (signature.toString("base64") !== status.sourceSignature ||
          !verify(null, Buffer.from(sourceSignatureMessage(status)), materials.publicKey, signature)) {
        failures.push("source_signature_invalid");
      }
    } catch {
      failures.push("source_signature_invalid");
    }
  }
  return { valid: failures.length === 0, failures };
}

export function buildEvidenceStatus({ env = process.env, now = Date.now() } = {}) {
  const { keyId, privateKey, publicKey } = signingMaterials(env);
  const currentTime = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(currentTime)) throw new Error("evidence_source_clock_invalid");
  const status = {
    ...EVIDENCE_CONTRACT,
    sourceIdentity: SOURCE_IDENTITY,
    sourceKeyId: keyId,
    sourceGeneratedAt: new Date(currentTime).toISOString(),
    sourceExpiresAt: new Date(currentTime + 60 * 1000).toISOString(),
    overall: "READY",
    // E0-E6 are only checks that this contract endpoint can safely attest its own
    // source identity, key configuration, freshness, schema, digest, signature,
    // and read-only behavior. They are not production acceptance gates G0-G6.
    gates: CHECK_IDS.map(id => ({ id, status: "READY" }))
  };
  status.sourceEvidenceDigest = sourceDigest(status);
  status.sourceSignature = sign(null, Buffer.from(sourceSignatureMessage(status)), privateKey).toString("base64");
  const checked = verifyEvidenceStatus(status, { env, now: currentTime });
  const schemaCheck = verifyEvidenceSchema(buildEvidenceSchema(env), { env });
  if (!checked.valid || !schemaCheck.valid) throw new Error("evidence_source_self_check_failed");
  const derivedPublicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const configuredPublicKey = publicKey.export({ type: "spki", format: "der" });
  if (!derivedPublicKey.equals(configuredPublicKey)) throw new Error("evidence_source_self_check_failed");
  return status;
}
