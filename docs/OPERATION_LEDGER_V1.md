# Operation Ledger v1

## Purpose
Persist the decision made by a trusted evidence verifier as an idempotent, hash-chained audit event. This is the next layer after the evidence envelope gate: the verifier decides whether the evidence is acceptable; the ledger records that decision and makes accidental or partial database edits detectable.

## Properties
- SQLite transaction with `BEGIN IMMEDIATE` serializes writers.
- Unique `(request_id, evidence_id)` provides idempotent retries; same content returns the original receipt, conflicting content fails.
- Each event commits to the previous event hash and its own canonical event content.
- Chain verification checks sequence continuity, previous-hash links, content hashes, and indexed-field consistency.
- Records ACCEPTED, REJECTED, and NOT_VERIFIED decisions; an acceptance is not production authorization.

## Canonicalization
Ledger hash profile v1 is UTF-8 of JSON sorted by key, compact separators, ASCII escapes, and non-finite numbers disallowed. This profile is for ledger hashing, not a declaration that the Ed25519 envelope signature profile is implemented.

## Production limitations
- The ledger does not authenticate an evidence envelope and must only be called after a trusted verifier in the same trust boundary.
- A hash chain detects edits only if the attacker cannot rewrite the entire database and recompute all hashes. Export/anchor head hashes to an independently controlled append-only store or signing service for tamper evidence against privileged DB access.
- SQLite is single-host durable storage, not a multi-host distributed ledger. Multi-host deployments need a transactional shared store with equivalent unique constraints and atomic append semantics.
- Back up and test restore; restrict database file permissions; monitor chain verification.
- This PR does not add a network endpoint, production signing keys, or deployment wiring.

## Tests
```sh
python -m unittest discover -s tests -p 'test_operation_ledger_v1.py' -v
```
