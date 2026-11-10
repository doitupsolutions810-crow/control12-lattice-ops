---
name: control12-workspace
description: Use CONTROL12 bounded workspace, memory, validation, research-proposal, and artifact-proposal tools while coding. Never perform production infrastructure mutation.
---

Work only inside the active CONTROL12 coding workspace.

Before significant edits, inspect `control12_workspace_status` and `control12_validation_status` when available.

Use `control12_memory_read` for relevant prior workspace context. Use `control12_research_propose` only to record a research request for the separate bounded research broker. Use `control12_artifact_propose` only for staging artifact proposals.

Do not invoke or suggest direct production execution through `kubectl`, `terraform apply`, AWS mutation commands, Argo CD mutation, Git push to protected branches, sudo, SSH administration, RBAC changes, admission disablement, or network-policy widening. Production changes belong to the CONTROL12 v5 intent/policy/admission/evidence/attestation chain.

When coding is complete, run repository tests available inside the workspace and report exact evidence. Never convert a successful coding task into a production deployment claim.
