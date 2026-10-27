#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const allowedRoleEvidence = new Set(["readme-inspected", "inventory-only"]);
const allowedIntegrationStatus = new Set(["not-end-to-end-verified", "not-inspected", "blocked", "verified"]);
const allowedInterfaceStatus = new Set(["proposed-not-verified", "blocked", "verified"]);
const shaPattern = /^[a-f0-9]{40}$/i;

function validSha(value) {
  return typeof value === "string" && shaPattern.test(value);
}

function validateExecutionProof(proof, { map, prefix, subjectRepository = null, edge = null }) {
  const errors = [];
  const add = (message) => errors.push(`${prefix} ${message}`);
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) {
    add("cannot be marked verified without a complete exact-run proof object");
    return errors;
  }

  if (subjectRepository) {
    if (proof.subjectRepository !== subjectRepository) add(`verification.subjectRepository must equal ${subjectRepository}`);
    if (!validSha(proof.commitSha)) add("verification.commitSha must be a full 40-character SHA");
  } else if (edge) {
    if (proof.sourceRepository !== edge.from) add(`verification.sourceRepository must equal edge.from (${edge.from})`);
    if (proof.targetRepository !== edge.to) add(`verification.targetRepository must equal edge.to (${edge.to})`);
    if (!validSha(proof.sourceCommitSha)) add("verification.sourceCommitSha must be a full 40-character SHA");
    if (!validSha(proof.targetCommitSha)) add("verification.targetCommitSha must be a full 40-character SHA");
  }

  const testRepository = proof.testRepository;
  if (typeof testRepository !== "string" || !map.repositories.some(repo => repo.name === testRepository)) {
    add("verification.testRepository must name a repository in the private registry");
  }
  if (!validSha(proof.testCommitSha)) add("verification.testCommitSha must be a full 40-character SHA");
  if (!validSha(proof.testRunHeadSha)) add("verification.testRunHeadSha must be a full 40-character SHA");
  if (validSha(proof.testCommitSha) && validSha(proof.testRunHeadSha) &&
      proof.testCommitSha.toLowerCase() !== proof.testRunHeadSha.toLowerCase()) {
    add("verification.testRunHeadSha must equal testCommitSha");
  }
  if (!Number.isSafeInteger(proof.testRunId) || proof.testRunId < 1) {
    add("verification.testRunId must be a positive safe integer");
  }
  if (!Number.isSafeInteger(proof.testRunAttempt) || proof.testRunAttempt < 1) {
    add("verification.testRunAttempt must be a positive safe integer");
  }
  if (proof.testRunConclusion !== "success") add("verification.testRunConclusion must equal success");
  if (proof.observedResult !== "pass") add("verification.observedResult must equal pass");

  let expectedRunUrl = "";
  if (typeof map.owner === "string" && typeof testRepository === "string" &&
      map.repositories.some(repo => repo.name === testRepository) &&
      Number.isSafeInteger(proof.testRunId) && proof.testRunId > 0) {
    expectedRunUrl = `https://github.com/${map.owner}/${testRepository}/actions/runs/${proof.testRunId}`;
  }
  if (!expectedRunUrl || proof.testRunUrl !== expectedRunUrl) {
    add("verification.testRunUrl must bind the registered test repository and run ID");
  }

  let runUrl;
  try {
    runUrl = new URL(proof.testRunUrl);
    if (runUrl.protocol !== "https:" || runUrl.hostname !== "github.com" ||
        runUrl.username || runUrl.password || runUrl.search || runUrl.hash) {
      add("verification.testRunUrl must be a canonical HTTPS GitHub Actions run URL");
    }
  } catch {
    add("verification.testRunUrl must be a canonical HTTPS GitHub Actions run URL");
  }

  try {
    const evidenceUrl = new URL(proof.evidenceUrl);
    if (!runUrl || evidenceUrl.protocol !== "https:" || evidenceUrl.hostname !== "github.com" ||
        evidenceUrl.username || evidenceUrl.password || evidenceUrl.search || evidenceUrl.hash ||
        !(evidenceUrl.pathname === runUrl.pathname || evidenceUrl.pathname.startsWith(runUrl.pathname + "/"))) {
      add("verification.evidenceUrl must be a durable URL within the exact test run");
    }
  } catch {
    add("verification.evidenceUrl must be a durable URL within the exact test run");
  }
  return errors;
}

export function validateRepositoryMap(map) {
  const errors = [];
  const add = (message) => errors.push(message);
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return ["map must be an object"];
  }
  if (map.schemaVersion !== 1) add("schemaVersion must equal 1");
  if (map.scope !== "complete-account-inventory-private") {
    add("private registry scope must equal complete-account-inventory-private");
  }
  if (typeof map.privacyRule !== "string" || !map.privacyRule.toLowerCase().includes("do not copy") ||
      !map.privacyRule.toLowerCase().includes("public")) {
    add("privacyRule must prohibit copying the full inventory into public repositories");
  }
  if (!map.operationEvidenceContract || map.operationEvidenceContract.version !== "v1" ||
      map.operationEvidenceContract.path !== "docs/OPERATION_EVIDENCE_CONTRACT_V1.md" ||
      map.operationEvidenceContract.schemaPath !== "contracts/operation-evidence/v1.schema.json" ||
      map.operationEvidenceContract.status !== "proposed") {
    add("operationEvidenceContract must bind the proposed v1 contract document and schema");
  }
  const g6Contract = map.g6ResidualMeasurementContract;
  const g6Mapping = {
    measurementSTopologicalToResidualS: "measurement.STopological -> residual.S",
    measuredAtToResidualMeasuredAt: "measuredAt -> residual.measuredAt",
    issuerToResidualSourceId: "issuer -> residual.sourceId",
    buildIdToResidualBuildId: "buildId must equal residual.buildId and the G0-G6 attestation buildId; it must be a shared composite release ID binding the Great Scale model run/artifact and Control Plane target build. If independent per-repository build IDs are used, v1 is insufficient and requires a versioned sourceBuildId/acceptanceBuildId contract.",
    sourceCommitEqualsWorkflowHead: "source.commitSha must equal execution.headSha",
    artifactBinding: "artifact.digest identifies the Great Scale model artifact and model.inputDigest binds its inputs; verify both independently and never substitute either for the Control Plane acceptance artifact digest.",
    trustBoundary: "verify Ed25519 against an independently configured public key; receipt cannot choose its trust anchor",
  };
  if (!g6Contract ||
      g6Contract.repository !== "great-scale" ||
      g6Contract.path !== "contracts/g6-residual-measurement/v1.schema.json" ||
      g6Contract.schemaBlobSha !== "a0956c825e9a8974f5855054d2c80eb4433391f9" ||
      g6Contract.version !== "v1" ||
      g6Contract.status !== "schema-only-not-producer" ||
      !g6Contract.mapping ||
      Object.keys(g6Contract.mapping).length !== Object.keys(g6Mapping).length ||
      Object.entries(g6Mapping).some(([key, value]) => g6Contract.mapping[key] !== value)) {
    add("g6ResidualMeasurementContract must pin the versioned schema blob and explicit downstream mapping");
  }
  if (typeof map.owner !== "string" || !map.owner.trim()) add("owner must be a non-empty string");
  if (typeof map.inventoryAsOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(map.inventoryAsOf)) {
    add("inventoryAsOf must be YYYY-MM-DD");
  }
  if (!Number.isInteger(map.expectedRepositoryCount) || map.expectedRepositoryCount < 1) {
    add("expectedRepositoryCount must be a positive integer");
  }
  if (!Array.isArray(map.repositories)) {
    add("repositories must be an array");
    return errors;
  }
  if (map.expectedRepositoryCount !== map.repositories.length) {
    add(`repository count mismatch: expected ${map.expectedRepositoryCount}, got ${map.repositories.length}`);
  }

  const names = new Set();
  for (const [index, repo] of map.repositories.entries()) {
    const prefix = `repositories[${index}]`;
    if (!repo || typeof repo !== "object" || Array.isArray(repo)) {
      add(`${prefix} must be an object`);
      continue;
    }
    if (typeof repo.name !== "string" || !repo.name.trim() || repo.name.includes("/")) {
      add(`${prefix}.name must be a non-empty repository name without a slash`);
    } else if (names.has(repo.name)) {
      add(`duplicate repository name: ${repo.name}`);
    } else {
      names.add(repo.name);
    }
    if (repo.owner !== map.owner) add(`${prefix}.owner must equal map.owner`);
    if (!["public", "private"].includes(repo.visibility)) add(`${prefix}.visibility must be public or private`);
    if (typeof repo.defaultBranch !== "string" || !repo.defaultBranch.trim()) add(`${prefix}.defaultBranch must be non-empty`);
    if (typeof repo.role !== "string" || !repo.role.trim()) add(`${prefix}.role must be non-empty`);
    if (!allowedRoleEvidence.has(repo.roleEvidence)) add(`${prefix}.roleEvidence is not recognized`);
    if (!allowedIntegrationStatus.has(repo.integrationStatus)) add(`${prefix}.integrationStatus is not recognized`);
    if (typeof repo.note !== "string" || !repo.note.trim()) add(`${prefix}.note must state the evidence or uncertainty`);
    if (repo.integrationStatus === "verified") {
      errors.push(...validateExecutionProof(repo.verification, { map, prefix, subjectRepository: repo.name }));
    }
  }

  if (!Array.isArray(map.interfaces)) {
    add("interfaces must be an array");
    return errors;
  }
  const edgeKeys = new Set();
  for (const [index, edge] of map.interfaces.entries()) {
    const prefix = `interfaces[${index}]`;
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      add(`${prefix} must be an object`);
      continue;
    }
    if (!names.has(edge.from)) add(`${prefix}.from references an unknown repository: ${edge.from}`);
    if (!names.has(edge.to)) add(`${prefix}.to references an unknown repository: ${edge.to}`);
    if (edge.from === edge.to) add(`${prefix} must connect two different repositories`);
    if (typeof edge.contract !== "string" || !edge.contract.trim()) add(`${prefix}.contract must be non-empty`);
    if (!allowedInterfaceStatus.has(edge.verificationStatus)) add(`${prefix}.verificationStatus is not recognized`);
    if (!Array.isArray(edge.requiredEvidence) || edge.requiredEvidence.length === 0) {
      add(`${prefix}.requiredEvidence must be a non-empty array`);
    }
    const key = `${edge.from} -> ${edge.to}`;
    if (edgeKeys.has(key)) add(`duplicate interface: ${key}`);
    edgeKeys.add(key);
    if (edge.verificationStatus === "verified") {
      errors.push(...validateExecutionProof(edge.verification, { map, prefix, edge }));
    }
  }
  return errors;
}

function run() {
  const mapPath = resolve(process.argv[2] ?? "governance/repository-map.json");
  let map;
  try {
    map = JSON.parse(readFileSync(mapPath, "utf8"));
  } catch (error) {
    console.error(`FAIL: cannot read valid JSON at ${mapPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = validateRepositoryMap(map);
  if (errors.length) {
    console.error(`FAIL: private repository map has ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  const counts = map.repositories.reduce((result, repo) => {
    result[repo.visibility] = (result[repo.visibility] ?? 0) + 1;
    return result;
  }, {});
  console.log(`PASS: private inventory is structurally valid (${map.repositories.length} repositories, ${map.interfaces.length} proposed interfaces; ${counts.public ?? 0} public, ${counts.private ?? 0} private).`);
  console.log("NOTE: inventory validity does not prove that repository interfaces or runtime behavior are connected.");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) run();
