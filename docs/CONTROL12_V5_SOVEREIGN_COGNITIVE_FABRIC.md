# CONTROL12 Sovereign Cognitive Fabric v5

## Purpose

CONTROL12 v5 evolves the lattice from direct chatbot-to-shell automation into a governed, evidence-driven autonomous control fabric.

## Control Flow

Human / Agent / API -> Intent Engine -> Planner -> Policy Engine -> Signed Execution Graph -> Control12 Fabric -> Evidence / Attestation -> Immutable Event Ledger.

The chatbot never directly mutates production. Natural-language requests are normalized into typed intents and evaluated against deterministic policy before execution.

## State Machine

INTENT -> PLAN -> POLICY -> BUILD -> VERIFY -> ADMIT -> EXECUTE -> OBSERVE -> ATTEST -> LEARN -> next INTENT

## Core Subsystems

1. Cognitive Command Plane: natural language to typed intents with deterministic authorization.
2. Persistent Workspace Fabric: revisioned workspaces for source, generated files, artifacts, attestations, execution records, and logs.
3. Agent Runtime Mesh: supervisor plus bounded reasoning, coding, artifact, infrastructure, and verifier agents.
4. Evidence-Native Deployment Engine: source commit, build provenance, digest, SBOM, signature, admission, rollout evidence, and final attestation.
5. Knowledge and Observability Plane: metrics, logs, traces, Git, CI/CD, Kubernetes, policies, artifacts, and receipts feed a common event layer.
6. Bounded Autonomous Recovery: recovery actions operate inside explicit capability and scope limits.

## Production Safety Invariant

No production-changing action is valid unless it has a causal chain back to an authorized intent and an allow decision from the policy engine.

## Release Evidence Chain

SOURCE -> COMMIT SHA -> BUILD PROVENANCE -> OCI DIGEST -> SBOM -> SIGNATURE -> ADMISSION RECORD -> ROLLOUT RECORD -> HEALTH EVIDENCE -> ATTESTATION

## Agent Model

Supervisor
- Reasoning Agent
- Coding Agent
- Artifact Agent
- Infrastructure Agent
- Verification Agent

Child agents receive only a subset of the capabilities delegated to their parent. Privilege expansion is denied by default.

## Workspace Model

/workspaces/{tenant}/{workspace_id}/
- source/
- generated/
- artifacts/
- attestations/
- execution/
- logs/
- workspace.manifest.json

Each mutation emits a revision record containing parent revision, actor, operation, path, content digest, and timestamp.

## Recovery Model

Autonomy may restart or reschedule workloads, reduce a canary, or roll back a release. It may not modify RBAC, rotate root keys, disable admission, or widen network policy without separately authorized control-plane actions.
