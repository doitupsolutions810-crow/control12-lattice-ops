# CONTROL12 Lattice Ops

Operational workers, live integration harnesses, and supporting scripts for the CONTROL12 / CycleKernel lattice (v15–v30 lineage).

## Scope

These components are **host / Kubernetes runtime only**. They are not intended for direct Vercel deployment.

Consoles and status surfaces live on Vercel:

- [cyclekernel-lattice-status](https://cyclekernel-lattice-status-pnud57x0s.vercel.app)
- [control12-lattice-v30](https://control12-lattice-v30-5vrd0gdqx.vercel.app)
- [control12-evidence-console](https://control12-evidence-console-rnguy8f6p.vercel.app)
- [cleanroom-v32-sovereign-console](https://cleanroom-v32-sovereign-console-9ok2946e3.vercel.app)
- [control12-launch-console](https://control12-launch-console-2cgsbwf69.vercel.app)

## Key Components

### Core Workers
- `control12-archive-durability-worker.py` — v30 erasure-coded archive durability (encode / scrub / repair / restore)
- `control12-snapshot-worker.py` — v29 snapshot catalog (full + incremental, restore, GC)
- `control12-data-continuity-worker.py` — v28 logical journal replay + PITR
- `control12-migration-resilience-worker.py` — v27 drift detection + authorized repair
- `control12-state-migration-worker.py` — v26 expand/verify/contract migrations
- `control12-deployment-worker.py` — fenced Kubernetes deployment worker
- `control12-fleet-controller.py` — progressive fleet campaigns
- `control12-autonomy-controller.py` — bounded autonomous cycles
- `control12-policy-optimizer.py` — shadow policy evaluation

### Build & Promotion
- `build-push-immutable.sh` + `preflight-runtime.sh`
- `control12-build-and-deploy.sh`
- `promote-approved-runner.sh` / `rollback-approved-runner.sh`

### Evidence & Backup
- `control12_audit_export.py`
- `control12_backup.py`

### Live Integration Harnesses
- `live-archive-durability-v30.py`
- `live-snapshot-catalog-v29.py`
- `live-data-continuity-v28.py`
- `live-migration-resilience-v27.py`
- `live-state-migration-v26.py`
- `live-fleet-integration.py` / `live-deployment-integration.py`
- and related live-*-integration scripts

## Security Notes

- No credentials or regional signing keys are stored in this repository.
- Workers expect secrets via environment / mounted files (`CONTROL12_TOKEN_FILE`, region keys, etc.).
- All evidence archives intentionally exclude credential values.

## License / Lineage

CycleKernel · CONTROL12 · GhostShell · Sovereign Runtime  
Flint Node lineage · onlinecyclekernel-deploy skill
