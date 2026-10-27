# CONTROL12 evidence console v5.4.0

This is a read-only, signed status surface, not a production-acceptance evaluator. It exposes only:

- GET /api/status — source-issued status contract with source generation time, expiry, canonical payload digest, and Ed25519 signature.
- GET /api/v1/evidence/schema — matching JSON Schema, independently pinning the source identity and key ID.

It writes no evidence, stores no requester data, and performs no production mutations. Evidence-console check identifiers E0–E6 refer only to integrity and availability of this status contract. They are not production gates G0–G6; production remains governed by separate operations/success evaluators. The producer's E-check definitions are: E0 source identity; E1 signing-key configuration and key-pair match; E2 source timestamp and expiry window; E3 the exact schema contract; E4 payload digest binding; E5 signature verification against the pinned key; E6 read-only GET behavior. The status emitter performs its key, timestamp, digest, signature, and schema self-checks before returning a READY contract; the endpoint handlers reject non-GET methods and do not write state. An unavailable signer returns HTTP 503 with no authority claim. It must never return a fabricated all-ready production decision.

## Vercel configuration

Use the existing control12-evidence-console Vercel project only after reviewing its ownership and release settings. Set Root Directory to evidence-console so the two functions are served at the exact paths:

- /api/status
- /api/v1/evidence/schema

This scaffold has not been deployed. The current production alias has previously been reported as HTTP 404; source code or a deployment-ready branch is not live-host evidence.

## Required runtime environment

Configure these in the evidence-console project's protected runtime environment. Do not put keys in source files, build artifacts, PR comments, or logs.

- EVIDENCE_SOURCE_KEY_ID: stable key identifier (1–128 ASCII letters, digits, dot, underscore, colon or hyphen).
- EVIDENCE_SOURCE_PRIVATE_KEY_PEM: Ed25519 private key in PEM form, used by this producer only.
- EVIDENCE_SOURCE_PUBLIC_KEY_PEM: matching Ed25519 SPKI public key in PEM form. The producer verifies that it matches the private key.

Separately configure the consumer (living-intermediate-control-plane) with the expected EVIDENCE_SOURCE_KEY_ID and independently pinned EVIDENCE_SOURCE_PUBLIC_KEY_PEM. Never give the consumer the private key. Missing configuration or a key-pair mismatch makes the endpoints return HTTP 503, causing procurement to remain on hold.

Use a new, owner-approved signing key and record its key ID/public-key fingerprint out of band. Do not generate or rotate a production key as part of this source-only change.

## Trust mechanics

The status payload contains a SHA-256 digest of canonical JSON with only sourceEvidenceDigest and sourceSignature omitted. Its Ed25519 signature covers the newline-delimited tuple sourceIdentity, sourceKeyId, sourceGeneratedAt, sourceExpiresAt, and sourceEvidenceDigest. The consumer independently recomputes the digest, validates the timestamp window, pins the key ID, verifies the signature, and checks status and schema separately.

Timestamps are issued on each request, expire after 60 seconds, and are rejected by the consumer after five minutes or once expired. A timestamp baked into a static file is not compliant. Signing the console's own contract checks does not prove the control plane is production-ready and does not replace an independent sequence/checkpoint for ledger completeness.

## Local validation

From this directory:

    npm test

Tests use an ephemeral keypair generated in memory and do not include or require production secrets.
