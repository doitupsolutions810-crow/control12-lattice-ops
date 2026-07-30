# CONTROL12 Lattice Ops

Operational workers, live integration harnesses, and supporting scripts for the CONTROL12 / CycleKernel lattice (v15–v30 lineage).

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

## Phase 4 — Cognitive Sync

Ghost Shell Sentience HUD (trait mapping overlay) is prepared and ready for deployment under the GhostShell / primary team surfaces. Mapping rules:

- High Entropy (L5 > 0.8) → Creative / Divergent prompts
- High Coupling (L2 > 0.05) → Analytical / Convergent prompts
- Low Core (Core < 0.1) → Survival / Conservation protocols

## Security Notes

- No credentials or regional signing keys are stored in this repository.
- Workers expect secrets via environment / mounted files (`CONTROL12_TOKEN_FILE`, region keys, etc.).
- All evidence archives intentionally exclude credential values.

## License / Lineage

CycleKernel · CONTROL12 · GhostShell · Sovereign Runtime  
Flint Node lineage · onlinecyclekernel-deploy · v3.1-ghost-sync
