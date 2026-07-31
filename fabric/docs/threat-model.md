# Threat model

Untrusted inputs include API requests, workflow definitions, plugin manifests, worker results, agent output, artifact bytes, and remote provider responses.

Controls:

- scoped expiring tokens and constant-time signature validation
- tenant boundary checks on every API collection
- request-size and request-rate limits
- separation of duties for approval records
- HMAC integrity for external plugin manifests
- HTTPS provider host allowlists
- digest-only production image plans
- append-only hash-chained event receipts
- non-root containers, read-only roots, dropped capabilities, seccomp, and network default deny
- bounded worker leases, retries, timeouts, stale-worker reaping, and idempotent state writes

The terminal capability remains isolated in the existing localhost-bound local-agent execution plane and is not exposed by Fabric v2.
