import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRepositoryMap } from "./validate-repository-map.mjs";

const baseline = JSON.parse(readFileSync(new URL("./repository-map.json", import.meta.url), "utf8"));

function runProof(testRepository = "great-scale", overrides = {}) {
  const testCommitSha = "c".repeat(40);
  const testRunId = 123456;
  const testRunUrl = `https://github.com/${baseline.owner}/${testRepository}/actions/runs/${testRunId}`;
  return {
    testRepository,
    testCommitSha,
    testRunHeadSha: testCommitSha,
    testRunId,
    testRunAttempt: 1,
    testRunConclusion: "success",
    testRunUrl,
    observedResult: "pass",
    evidenceUrl: testRunUrl + "/artifacts/789",
    ...overrides,
  };
}

function repositoryProof(subjectRepository, overrides = {}) {
  return {
    subjectRepository,
    commitSha: "a".repeat(40),
    ...runProof("great-scale"),
    ...overrides,
  };
}

function edgeProof(edge, overrides = {}) {
  return {
    sourceRepository: edge.from,
    targetRepository: edge.to,
    sourceCommitSha: "a".repeat(40),
    targetCommitSha: "b".repeat(40),
    ...runProof("great-scale"),
    ...overrides,
  };
}

test("private full-account snapshot is structurally valid and makes no runtime claims", () => {
  assert.equal(baseline.scope, "complete-account-inventory-private");
  assert.equal(baseline.repositories.length, 35);
  assert.equal(baseline.repositories.length, baseline.expectedRepositoryCount);
  assert.equal(baseline.repositories.filter(repo => repo.visibility === "public").length, 14);
  assert.equal(baseline.repositories.filter(repo => repo.visibility === "private").length, 21);
  assert.equal(baseline.interfaces.length, 10);
  assert.ok(baseline.repositories.every(repo => repo.integrationStatus === "not-end-to-end-verified"));
  assert.ok(baseline.interfaces.every(edge => edge.verificationStatus === "proposed-not-verified"));
  assert.deepEqual(validateRepositoryMap(baseline), []);
});

test("duplicate repository names and inventory count drift are rejected", () => {
  const duplicate = structuredClone(baseline);
  duplicate.repositories.push(structuredClone(duplicate.repositories[0]));
  duplicate.expectedRepositoryCount += 1;
  assert.ok(validateRepositoryMap(duplicate).some(message => message.startsWith("duplicate repository name:")));

  const countDrift = structuredClone(baseline);
  countDrift.expectedRepositoryCount += 1;
  assert.ok(validateRepositoryMap(countDrift).some(message => message.includes("repository count mismatch")));
});

test("private registry cannot lose its confidentiality boundary", () => {
  const wrongScope = structuredClone(baseline);
  wrongScope.scope = "public-only";
  assert.ok(validateRepositoryMap(wrongScope).some(message => message.includes("private registry scope")));

  const missingPrivacyRule = structuredClone(baseline);
  delete missingPrivacyRule.privacyRule;
  assert.ok(validateRepositoryMap(missingPrivacyRule).some(message => message.includes("privacyRule")));
});

test("unknown and duplicate interface endpoints are rejected", () => {
  const unknown = structuredClone(baseline);
  unknown.interfaces[0].to = "repository-that-does-not-exist";
  assert.ok(validateRepositoryMap(unknown).some(message => message.includes("unknown repository")));

  const duplicate = structuredClone(baseline);
  duplicate.interfaces.push(structuredClone(duplicate.interfaces[0]));
  assert.ok(validateRepositoryMap(duplicate).some(message => message.includes("duplicate interface")));
});

test("a repository or interface cannot be promoted without an exact-run proof", () => {
  const repositoryCandidate = structuredClone(baseline);
  repositoryCandidate.repositories[0].integrationStatus = "verified";
  assert.ok(validateRepositoryMap(repositoryCandidate).some(message => message.includes("complete exact-run proof object")));

  const edgeCandidate = structuredClone(baseline);
  edgeCandidate.interfaces[0].verificationStatus = "verified";
  assert.ok(validateRepositoryMap(edgeCandidate).some(message => message.includes("complete exact-run proof object")));
});

test("fully bound successful evidence supports structurally valid repository and edge proofs", () => {
  const repositoryCandidate = structuredClone(baseline);
  const subject = repositoryCandidate.repositories[0];
  subject.integrationStatus = "verified";
  subject.verification = repositoryProof(subject.name);
  assert.deepEqual(validateRepositoryMap(repositoryCandidate), []);

  const edgeCandidate = structuredClone(baseline);
  const edge = edgeCandidate.interfaces[0];
  edge.verificationStatus = "verified";
  edge.verification = edgeProof(edge);
  assert.deepEqual(validateRepositoryMap(edgeCandidate), []);
});

test("failed runs, wrong run heads, and invalid attempts are rejected", () => {
  const failedRun = structuredClone(baseline);
  const edge = failedRun.interfaces[0];
  edge.verificationStatus = "verified";
  edge.verification = edgeProof(edge, { testRunConclusion: "failure" });
  assert.ok(validateRepositoryMap(failedRun).some(message => message.includes("testRunConclusion must equal success")));

  const wrongHead = structuredClone(baseline);
  const edge2 = wrongHead.interfaces[0];
  edge2.verificationStatus = "verified";
  edge2.verification = edgeProof(edge2, { testRunHeadSha: "d".repeat(40) });
  assert.ok(validateRepositoryMap(wrongHead).some(message => message.includes("testRunHeadSha must equal testCommitSha")));

  const badAttempt = structuredClone(baseline);
  const edge3 = badAttempt.interfaces[0];
  edge3.verificationStatus = "verified";
  edge3.verification = edgeProof(edge3, { testRunAttempt: 0 });
  assert.ok(validateRepositoryMap(badAttempt).some(message => message.includes("testRunAttempt must be a positive safe integer")));
});

test("proof cannot be replayed onto a different subject or interface", () => {
  const wrongRepo = structuredClone(baseline);
  const subject = wrongRepo.repositories[0];
  subject.integrationStatus = "verified";
  subject.verification = repositoryProof("not-" + subject.name);
  assert.ok(validateRepositoryMap(wrongRepo).some(message => message.includes("subjectRepository must equal")));

  const wrongEdge = structuredClone(baseline);
  const edge = wrongEdge.interfaces[0];
  edge.verificationStatus = "verified";
  edge.verification = edgeProof(edge, { targetRepository: edge.from });
  assert.ok(validateRepositoryMap(wrongEdge).some(message => message.includes("targetRepository must equal edge.to")));
});

test("endpoint commit identities are mandatory and full length", () => {
  const candidate = structuredClone(baseline);
  const edge = candidate.interfaces[0];
  edge.verificationStatus = "verified";
  const proof = edgeProof(edge);
  delete proof.targetCommitSha;
  edge.verification = proof;
  assert.ok(validateRepositoryMap(candidate).some(message => message.includes("targetCommitSha must be a full 40-character SHA")));
});

test("run and evidence URLs must belong to the exact registered Actions run", () => {
  const wrongRun = structuredClone(baseline);
  const edge = wrongRun.interfaces[0];
  edge.verificationStatus = "verified";
  edge.verification = edgeProof(edge, {
    testRunUrl: `https://github.com/${baseline.owner}/another-repo/actions/runs/123456`
  });
  assert.ok(validateRepositoryMap(wrongRun).some(message => message.includes("testRunUrl must bind the registered test repository and run ID")));

  const replay = structuredClone(baseline);
  const edge2 = replay.interfaces[0];
  edge2.verificationStatus = "verified";
  edge2.verification = edgeProof(edge2, {
    evidenceUrl: `https://github.com/${baseline.owner}/great-scale/actions/runs/999999/artifacts/789`
  });
  assert.ok(validateRepositoryMap(replay).some(message => message.includes("evidenceUrl must be a durable URL within the exact test run")));
});

test("signed E0-E6 source-console edge stays separate from G0-G6 production acceptance", () => {
  const edge = baseline.interfaces.find(item =>
    item.from === "control12-lattice-ops" && item.to === "living-intermediate-control-plane"
  );
  assert.ok(edge, "private inventory records the signed source-console edge");
  assert.equal(edge.verificationStatus, "proposed-not-verified");
  assert.match(edge.contract, /E0-E6/);
  assert.match(edge.contract, /not G0-G6 production acceptance/i);
  assert.ok(edge.requiredEvidence.includes("ed25519-signature-verified-against-independent-pinned-key"));
  assert.ok(edge.requiredEvidence.includes("exact-head-end-to-end-test-run"));
  assert.ok(edge.requiredEvidence.includes("explicit-e0-e6-versus-g0-g6-separation"));
});

test("operation evidence reference remains pinned to the proposed v1 contract", () => {
  const candidate = structuredClone(baseline);
  candidate.operationEvidenceContract.version = "v99";
  assert.ok(validateRepositoryMap(candidate).some(message => message.includes("operationEvidenceContract")));
});
