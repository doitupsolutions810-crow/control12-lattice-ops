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
