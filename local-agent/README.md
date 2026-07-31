# CONTROL12 Local Agent v0.8.1

A localhost-only macOS agent runtime backed by `llama.cpp` with a five-role evidence-grounded quorum.

## Agents

- `planner` — decomposes goals and identifies evidence needs.
- `engineer` — evaluates implementation and runtime state.
- `artifact` — verifies files, outputs, and reproducibility.
- `operations` — evaluates service and host readiness.
- `verifier` — rejects unsupported claims and synthesizes decisions.

## Deterministic readiness

Chat and individual agent analysis remain model-backed. The readiness quorum is authoritative only when derived from collected local evidence. It evaluates command exit codes, the llama.cpp health endpoint, and observed CONTROL12 and llama-server processes.

Model-generated readiness JSON is explicitly non-authoritative. This prevents fenced, truncated, or malformed model output from changing a verified readiness decision.

## Capabilities

Fast chat, persistent JSONL memory, local terminal tool execution, live macOS evidence collection, deterministic five-agent readiness, model and application health endpoints, individual evidence-grounded agent execution, and a macOS lifecycle launcher.

## Install on macOS

```bash
git clone https://github.com/doitupsolutions810-crow/control12-lattice-ops.git
cd control12-lattice-ops/local-agent
bash scripts/install-macos.sh
```

The installer uses Homebrew to install `node@22`, `llama.cpp`, and `jq`. The model defaults to `ggml-org/gemma-3-4b-it-GGUF:Q4_K_M` and is downloaded by `llama-server` on first start. Installation completes only after the deterministic five-agent quorum returns a non-`UNKNOWN` decision.

## Commands

```bash
control12-app status
control12-app doctor
control12-app chat "Reply exactly: CONTROL12 READY"
control12-app quorum "Report only verified local readiness facts"
control12-app agent verifier "Inspect current local readiness"
control12-app agents
control12-app evidence
control12-app task "pwd && uname -m && sw_vers"
control12-app memory 50
control12-app capabilities
```

A successful quorum reports:

```json
{
  "provider": "deterministic-local-evidence",
  "synthesis": {
    "decision": "READY"
  }
}
```

## Security boundary

The HTTP service binds to `127.0.0.1`. Quorum claims cite collected evidence keys. Terminal execution is local and powerful; run only trusted commands and do not expose port 4312 to untrusted networks.

## Development

```bash
npm run check
npm test
```
