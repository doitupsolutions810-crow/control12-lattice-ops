# CONTROL12 Lattice Ops

Operational workers, live integration harnesses, and supporting scripts for the CONTROL12 / CycleKernel lattice (v15–v30 lineage), now extended with the CONTROL12 Sovereign Cognitive Fabric v5 control architecture.

## CONTROL12 Sovereign Cognitive Fabric v5

The v5 layer converts conversational and agent requests into typed intents, deterministic execution plans, bounded capabilities, policy admission, evidence-native deployment, attestation, and immutable ledger records.

Core flow:

`INTENT -> PLAN -> POLICY -> BUILD -> VERIFY -> ADMIT -> EXECUTE -> OBSERVE -> ATTEST -> LEARN`

New v5 assets:

- `docs/CONTROL12_V5_SOVEREIGN_COGNITIVE_FABRIC.md` — architecture and safety invariants
- `schemas/control12.intent.v5.schema.json` — typed intent schema
- `control-plane/planner.py` — deterministic release execution planner
- `control-plane/agent-capabilities.json` — bounded five-agent capability model plus supervisor
- `policy/recovery-policy.v5.yaml` — bounded autonomous recovery policy
- `tests/test_v5_planner.py` — planner validation

Production-changing actions are never considered valid solely because an LLM emitted a command or a process returned exit code 0. The v5 invariant requires an authorized intent, deterministic policy allow decision, evidence chain, and attestation.

## Scope

These components are **host / Kubernetes runtime only**. They are not intended for direct Vercel deployment.

Consoles and status surfaces live on Vercel:

- [cyclekernel-lattice-status](https://cyclekernel-lattice-status-7y9nn96ae.vercel.app)
- [control12-lattice-v30](https://control12-lattice-v30-5vrd0gdqx.vercel.app)
- [control12-evidence-console](https://control12-evidence-console-jkdofnsfu.vercel.app)
- [cleanroom-v32-sovereign-console](https://cleanroom-v32-sovereign-console-9ok2946e3.vercel.app)
- [control12-launch-console](https://control12-launch-console-nz6b2wwbg.vercel.app)

## Pushed Workers (this repo)

### scripts/
- `build-push-immutable.sh` — digest-pinned, SBOM, cosign, crane
- `preflight-runtime.sh` — builder + registry credential checks

### workers/
- `control12-autonomy-controller.py` — bounded v18 autonomy cycles
- `control12-fleet-controller.py` — v17 progressive fleet campaigns
- `control12-policy-optimizer.py` — v19 shadow optimization evaluation

### Still pending push (available in attachments)
- `control12-archive-durability-worker.py` (v30)
- `control12-snapshot-worker.py` (v29)
- `control12-data-continuity-worker.py` (v28)
- `control12-deployment-worker.py`
- `control12-migration-resilience-worker.py` / `control12-state-migration-worker.py`
- `control12_audit_export.py` / `control12_backup.py`
- live-*-integration harnesses

## CONTROL12 Local Agent

`local-agent/` contains the repaired and upgraded macOS runtime:

- CONTROL12 v0.8.0 localhost service
- five specialized agents: planner, engineer, artifact, operations, verifier
- fast chat and evidence-grounded quorum modes
- individual evidence-grounded agent execution
- persistent JSONL memory and bounded local terminal execution
- live evidence, health, agent, and capability endpoints
- reproducible Homebrew installer and lifecycle controller
- macOS GitHub Actions syntax and source tests

See [`local-agent/README.md`](local-agent/README.md) for installation and operation.

## Phase 4 — Cognitive Sync

Ghost Shell Sentience HUD (trait mapping overlay) is prepared and ready for deployment under the GhostShell / primary team surfaces. Mapping rules:

- High Entropy (L5 > 0.8) → Creative / Divergent prompts
- High Coupling (L2 > 0.05) → Analytical / Convergent prompts
- Low Core (Core < 0.1) → Survival / Conservation protocols

## Security Notes

- No credentials or regional signing keys are stored in this repository.
- Workers expect secrets via environment / mounted files (`CONTROL12_TOKEN_FILE`, region keys, etc.).
- All evidence archives intentionally exclude credential values.
- The local agent binds to `127.0.0.1`; do not expose its terminal endpoint to untrusted networks.

## License / Lineage

CycleKernel · CONTROL12 · GhostShell · Sovereign Runtime  
Flint Node lineage · onlinecyclekernel-deploy · v3.1-ghost-sync
