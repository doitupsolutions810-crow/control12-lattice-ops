# CONTROL12 Local Agent v0.8.0

A localhost-only macOS agent runtime backed by `llama.cpp` and a five-role evidence-grounded quorum.

## Agents

- `planner` — decomposes goals and identifies evidence needs.
- `engineer` — evaluates implementation and runtime state.
- `artifact` — verifies files, outputs, and reproducibility.
- `operations` — evaluates service and host readiness.
- `verifier` — rejects unsupported claims and synthesizes decisions.

## Capabilities

Fast chat, bounded two-worker quorum execution, persistent JSONL memory, local terminal tool execution, live macOS evidence collection, JSON-schema outputs, model and application health endpoints, and a macOS lifecycle launcher.

## Install on macOS

```bash
git clone https://github.com/doitupsolutions810-crow/control12-lattice-ops.git
cd control12-lattice-ops/local-agent
./scripts/install-macos.sh
```

The installer uses Homebrew to install `node@22`, `llama.cpp`, and `jq`. The model defaults to `ggml-org/gemma-3-4b-it-GGUF:Q4_K_M` and is downloaded by `llama-server` on first start.

## Commands

```bash
control12-app status
control12-app doctor
control12-app chat "Reply exactly: CONTROL12 READY"
control12-app quorum "Report only verified local readiness facts"
control12-app task "pwd && uname -m && sw_vers"
control12-app memory
control12-app capabilities
```

## Security boundary

The HTTP service binds to `127.0.0.1`. Quorum claims must cite collected evidence keys. Terminal execution is local and powerful; run only trusted commands and do not expose port 4312 to untrusted networks.

## Development

```bash
npm run check
npm test
```
