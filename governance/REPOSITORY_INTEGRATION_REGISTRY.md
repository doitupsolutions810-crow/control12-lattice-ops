# Complete Repository Integration Registry

This access-controlled registry records the current inventory of repositories available to the linked owner account and the proposed integration boundaries.

## Confidentiality boundary

- Source: `governance/repository-map.json`.
- Snapshot date: 2026-10-27.
- This file contains public and private repository metadata. Keep it in this private repository; do not copy it into a public repository or publish it as a public artifact.
- Public-facing projects should carry a separate public-only subset with private names and metadata excluded.

## Evidence semantics

- `readme-inspected`: a project README was inspected during this inventory pass; this is not a code audit.
- `inventory-only`: the repository's implementation role has not been established from source in this pass.
- `not-end-to-end-verified`: repository presence and metadata do not prove a live integration.
- `proposed-not-verified`: an edge describes a required contract, not an implemented or tested connection.

No repository or edge in this snapshot is marked verified.

## Required promotion evidence

Run the private inventory's structural/adversarial checks with:

```sh
node --test governance/test_repository_map.mjs
node governance/validate-repository-map.mjs
```

Before changing any repository or interface entry to `verified`, the proof must bind:

- `subjectRepository` and its full `commitSha`, for repository-level claims; or exact `sourceRepository` / `targetRepository` identities and full `sourceCommitSha` / `targetCommitSha`, for interface claims.
- A registered `testRepository`, full `testCommitSha`, and `testRunHeadSha` equal to that test commit.
- The exact positive `testRunId` and `testRunAttempt`, canonical run URL for that repository/run, `testRunConclusion=success`, and `observedResult=pass`.
- A durable HTTPS `evidenceUrl` contained within that exact Actions run.

The validator enforces shape and cross-field consistency. It does not fetch GitHub's Actions API or independently verify the truth of the run/result/commit assertions. Before promotion, inspect the real run metadata and evidence artifact to verify that all three repositories/revisions (source, target, test harness) match the recorded proof. The public registry uses the same promotion shape but contains only public records.

A job that fails before recording any steps is a verification/infrastructure blocker with unknown cause. It is neither a test pass nor evidence of a source-code assertion failure.

## Refresh and validation

1. Refresh the account repository inventory and default-branch names.
2. Inspect source entry points and actual API/schema contracts, not names alone.
3. Keep repository inventory count synchronized with the records.
4. Test every proposed edge against pinned revisions; attach observed results before promoting its status.
5. Keep production-changing actions blocked until their explicit authorization and evidence gates pass.

## Shared operation/evidence contract

The candidate cross-repository envelope is specified in the public Great Scale repository at `docs/OPERATION_EVIDENCE_CONTRACT_V1.md` with JSON Schema `contracts/operation-evidence/v1.schema.json`. Both references are proposed only. The private inventory records the contract location; it does not claim that the services already emit or consume the schema. An interface stays unverified until an exact-head integration test demonstrates this contract in actual requests and durable receipts.

## Signed source-console edge: E0-E6 is not G0-G6

The private registry now explicitly records a proposed edge from CONTROL12 Lattice Ops to the Living Intermediate Control Plane for the read-only v5.4.0 status/schema pair. The producer candidate emits a canonical status digest, schema digest, source identity and key ID, timestamps, and an Ed25519 signature; the consumer candidate re-computes the digests, checks exact source/schema fields and freshness, and verifies the signature using an independently configured public key.

That source-console contract proves the provenance and integrity of the console's own E0-E6 status only. It does not establish operational G0-G6 production acceptance, actual deployment health, immutable artifact provenance, or release authority. The edge remains `proposed-not-verified` until both exact source revisions and the live status/schema responses are tested together, the signature/key binding is verified, and an inspectable exact-head end-to-end run passes.


## GitHub Actions pre-job failure triage — 2026-10-27

Observed on this branch, run [40451959282](https://github.com/doitupsolutions810-crow/control12-lattice-ops/actions/runs/40451959282) returns `name=""`, `path="BuildFailed"`, `conclusion="startup_failure"`, `jobs=[]`, and no steps or runner. The normal workflow directory exists on both `main` and this branch and has the same 12 filenames and identical blob SHAs; the normal `.github/workflows/ci.yml` is present on default branch and has unchanged content. This rules out the simple explanations “there is no workflow file on main” and “the PR branch deleted/changed the workflow set”; it does not rule out all workflow syntax, policy, permission, or Actions-registration problems.

The same `BuildFailed / startup_failure / zero jobs` signature has been reported by other repository owners in [GitHub Community discussion #208832](https://github.com/orgs/community/discussions/208832) (opened 2026-09-26), including reproduction from a previously healthy commit. This is corroborating evidence for investigating GitHub's workflow registration/dispatch state, not proof that this repository has the same root cause. GitHub's public status page currently reports Actions operational; no public incident explains this account's individual runs.

**Safe response sequence:** preserve run IDs and workflow-file SHAs; inspect the Actions UI for the user-visible startup reason; verify repository-level Actions enablement, allowed-action policy, and billing/account usage from the owner's GitHub settings; if the synthetic `BuildFailed` status persists while the normal workflow files remain unchanged, send GitHub Support the repository name, run ID, workflow ID `324662747`, check-suite ID `109638318359`, exact commit SHA, and the workflow-file hashes. Do not fabricate a `BuildFailed.yml`, rename branches, weaken CI checks, or keep rerunning unchanged workflows. The connector used for this audit cannot inspect the required Actions settings endpoint, so those controls remain **unverified**.


## G6 residual numeric domain

The topology-derived residual coordinate is (S=(1-	au^2)/4) with (	au) in [0, 1], hence the supported G6 domain is **`0 <= S <= 0.25`**. The lower-bound cone predicate is not a complete domain validator: by itself it can accept an arbitrarily large positive scalar. A signed production acceptance artifact must still be rejected if `S` is non-finite or outside [0, 0.25]. A signature authenticates the claim; it does not make a mathematically out-of-domain value valid.



## Pinned G6 measurement receipt schema

The private registry now pins Great Scale's public contract at `great-scale/contracts/g6-residual-measurement/v1.schema.json`, Git blob SHA `002c4abb141833e1361fa96d36474dece1a77ad1`, status `schema-only-not-producer`. The intended mapping is `measurement.STopological → residual.S`, `measuredAt → residual.measuredAt`, `issuer → residual.sourceId`, `targetBuildId → residual.buildId`, `target.repository/commitSha → the final G0-G6 attestation source identity`, and `targetArtifact.digest → the final G0-G6 attestation artifact.digest`. `measurementBuildId` is the Great Scale-side measurement build and must remain distinct from the target Control Plane build. The map validator requires this exact path, blob SHA, version, status and mapping.

This receipt schema binds model/version/parameters/input digest, source commit, successful run/attempt/head, artifact digest, measurement time, numeric residual domain, numerical convergence/error diagnostics, canonical SHA-256 digest and Ed25519 signature metadata. The schema does not perform cross-field verification or query the Actions API. The production producer must verify the actual run and artifact, ensure source commit equals workflow head, reproduce the model/input/artifact binding, check timestamps, recompute canonical digest, verify the signature under an independently pinned key, and map the G6 residual into the final signed G0-G6 attestation.

The connection remains `proposed-not-verified`: no live producer, endpoint, or provisioned G6 signing key has been verified. The private map is not to be treated as evidence that this service currently exists.


## Refined G6 measurement evidence and Actions triage — 2026-10-27

The Great Scale → Living Intermediate Control Plane edge remains `proposed-not-verified`. Great Scale now defines `contracts/g6-residual-measurement/v1.schema.json` and `docs/G6_RESIDUAL_MEASUREMENT_CONTRACT_V1.md` for a richer G6 measurement receipt. It requires the actual QGT/topological tuple and numerical checks (Chern/integrated curvature, absolute and positive/negative curvature budgets, metric-area excess, signed polarization, (S_T)/(Psi_T), quadrature/grid-origin diagnostics, empirical Richardson estimates and convergence) plus exact source revision, successful run/attempt, build/artifact pins, freshness and canonical digest. Its `numericalCertification` must carry an independently signed error certificate (`certificateKeyId`/`certificateSignature`) with its own freshness window, exact source/model-input binding, proof URL/digest, and certified curvature/metric-area error upper bounds within tolerance. The numerical-certificate key must be pinned independently of the outer G6 receipt key. The schema is now accompanied by a model-conformance test in Great Scale's candidate PR #129 and wired into its `npm test`.

The consumer must not assume that this schema or model library creates live measurements. `public/residual.cjs` is a calculation module, not a running production endpoint. The trusted G0-G6 producer still must fetch the durable measurement evidence, independently verify the run/source/build/artifact/signature and numerical predicates, and only then bind `measurement.STopological` into its compact signed residual. Production remains HOLD / NO-GO.

### Actions root-cause caveat

The private Lattice Ops synthetic run [#40452934805](https://github.com/doitupsolutions810-crow/control12-lattice-ops/actions/runs/40452934805) still reports `name=""`, `path="BuildFailed"`, `startup_failure`, and no jobs. A public GitHub Community report documents one case with this exact signature that was resolved by correcting an account-level billing lock, rather than by changing workflow YAML: https://github.com/orgs/community/discussions/208287. Other reports describe similar signatures with Actions enabled and billing apparently valid; these are community reports, not a diagnosis for this account. The broader candidate stack also has public repositories whose normal named workflows fail with zero executed steps, so do not force a single root cause from signature similarity alone.

**Owner verification:** check account payment method / billing authorization and Actions spending limits first, then inspect repository Actions settings and the UI's startup error. If the synthetic `BuildFailed` row persists after those checks, contact GitHub Support with workflow ID `324662747`, check-suite ID `109640886214`, run ID `40452934805`, and head SHA `a50df8ac8501157c39a4749fddb2fd9cf85cedcb`. No billing information or Actions permission state was readable through this audit, and no CI pass is claimed.

## Separate source and target identities in the G6 mapping

The pinned Great Scale G6 receipt schema distinguishes the Great Scale model artifact digest from the Control Plane production artifact digest. `source.commitSha` identifies the Great Scale model revision and must equal that receipt's `execution.headSha`; it is not the Control Plane source SHA. The receipt `targetBuildId` maps into the Control Plane residual build ID, and the Control Plane verifier requires it to equal the final G0-G6 attestation build ID. `measurementBuildId` is source-side provenance and is not copied into the residual field. `target.repository/commitSha` must match the attestation's source identity, and `targetArtifact.digest` must match its pinned target artifact digest.

The schema now carries both identities explicitly: `measurementBuildId` for the Great Scale producer/model execution and `targetBuildId` for the intended Control Plane release. It also pins the exact target source commit and a separate `targetArtifact.digest`. A trusted consumer must verify these relationships against the actual final G0-G6 attestation before mapping the residual. This avoids pretending independently generated service build IDs are one ID; it does not authorize the source receipt by itself.


## G6 numerical-certificate boundary

The current Great Scale QGT implementation reports Richardson-style error estimates with a heuristic safety factor. Those values are useful diagnostics but are **not certified upper bounds**. The model explicitly reports `modelG6CertificationEligible=false`; `topologicalMappingValid=true` and `quadratureConverged=true` are consistency/convergence results, not a proof that the quadrature error is bounded rigorously.

The proposed G6 receipt schema therefore requires a distinct `numericalCertification` object using the approved `interval-enclosure-v1` or `analytic-derivative-bound-v1` method, with an independently pinned certificate key, source SHA and model-input digest, canonical proof digest, evidence URL, strict generated/expiry times, and certified curvature/metric-area error upper bounds within the measurement tolerance. The outer G6 producer must validate the certificate signature and artifact independently; the certificate's `verified=true` field cannot establish its own trust.

No certified interval/analytic proof producer or live signed receipt is available in the checked candidate path. Until that missing producer exists and exact-head end-to-end tests execute successfully, the Great Scale → Control Plane edge remains `proposed-not-verified`, G6 remains blocked, and production stays HOLD / NO-GO.
