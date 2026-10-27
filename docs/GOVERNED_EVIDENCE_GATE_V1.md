# CONTROL12 Governed Evidence Gate v1

## What this implements

A standard-library Python verifier for a versioned cross-repository evidence envelope. It fails closed on missing fields, unsupported schemas, simulation, missing worker receipts, repository/revision/artifact or policy mismatch, local evidence under production policy, malformed authority/signature metadata, bad/stale/future/expired timestamps, failed signature verification, and replay-store errors.

## Trust boundaries

- This is an **evidence acceptance primitive**, not a production authorization decision. Successful results always set `production_authorized: false`; a separate policy/admission gate must decide whether the operation is authorized.
- `signature_verifier` MUST verify Ed25519 using independently pinned trusted keys, issuer scope, and a documented canonical serialization profile. A caller-provided boolean is not a cryptographic verifier. Do not use the test lambda in production.
- `replay_guard` MUST atomically consume a request/evidence pair in durable shared storage. The in-memory test guard exists only for unit tests. Storage errors fail closed.
- Expected repository, exact full Git commit SHA, artifact digest, policy ID/version, clock, and freshness bound come from trusted deployment configuration, not the envelope being checked.
- A receipt identifier is a reference, not proof by itself. The trusted verifier/producer must validate the receipt and its binding to actual execution.
- The gate does not prove the underlying tests were meaningful, the artifact is safe, or a numerical claim is rigorous. Those require separate verifiers and policies.

## Run tests

From repository root:

```sh
python -m unittest discover -s tests -p 'test_evidence_gate_v1.py' -v
```

The test suite uses only Python's standard library. Passing these unit tests does not prove cross-repository integration or production readiness.

## Promotion status

This is a new draft implementation candidate. It has not been run by hosted CI at this commit, has no production keys or durable replay-store adapter, and is not wired into all existing consumers. Do not merge or enable production authority solely on this implementation.
