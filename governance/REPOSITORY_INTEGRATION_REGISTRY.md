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

Before changing any entry to `verified`, attach a full 40-character commit SHA, an actual test/workflow run URL, an observed result, and a durable evidence URL. For security-sensitive edges, validate authorization scope, issuer authenticity, freshness, and revision binding independently.

A job that fails before recording any steps is a verification/infrastructure blocker with unknown cause. It is neither a test pass nor evidence of a source-code assertion failure.

## Refresh and validation

1. Refresh the account repository inventory and default-branch names.
2. Inspect source entry points and actual API/schema contracts, not names alone.
3. Keep repository inventory count synchronized with the records.
4. Test every proposed edge against pinned revisions; attach observed results before promoting its status.
5. Keep production-changing actions blocked until their explicit authorization and evidence gates pass.

## Shared operation/evidence contract

The candidate cross-repository envelope is specified in the public Great Scale repository at `docs/OPERATION_EVIDENCE_CONTRACT_V1.md` with JSON Schema `contracts/operation-evidence/v1.schema.json`. Both references are proposed only. The private inventory records the contract location; it does not claim that the services already emit or consume the schema. An interface stays unverified until an exact-head integration test demonstrates this contract in actual requests and durable receipts.
