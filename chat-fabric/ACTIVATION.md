# CONTROL12 Chat Fabric — Activation Contract

This layer intentionally uses a small success gate. It is eligible for staging only when all five criteria pass.

## One-command validation

```bash
bash scripts/validate-chat-fabric.sh
```

The command writes:

```text
.control12-validation/chat-fabric-validation.json
```

and prints its SHA-256 digest.

## Five success criteria

1. **Tests execute** — the chat/workspace Node tests complete successfully.
2. **Workspace confinement holds** — traversal and symlink escape tests pass and revisions remain chained.
3. **Research boundary parses** — the separately governed research broker passes syntax validation; live network access is not granted to workspace code by default.
4. **Artifact runtime is default-deny** — workspace containers use no network by default, read-only root, dropped capabilities, non-root execution, and bounded resources.
5. **Chat has no direct production authority** — production execution remains hard-denied and must cross the existing CONTROL12 v5 policy/admission path.

## Identity rule

Local development binds to loopback and unsigned callers are forced to the ordinary `user` role.

Any non-loopback deployment must set `CONTROL12_GATEWAY_SECRET`. Tenant, workspace, role, and actor headers are trusted only when accompanied by a fresh HMAC-SHA256 identity assertion from the trusted gateway.

## Promotion rule

- `success: true` in the validation report: eligible for **staging** review.
- Any failed criterion: remain in the coding workspace; do not promote.
- Production remains a separate CONTROL12 v5 admission decision with evidence and attestation.

This contract deliberately does not require cloud failover, multi-region deployment, external model providers, PagerDuty, blockchain, or other optional integrations before the core chatbot/workspace system can be validated and used safely in staging.
