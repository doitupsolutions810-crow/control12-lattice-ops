#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v copilot >/dev/null || { echo 'copilot CLI not installed' >&2; exit 69; }
command -v node >/dev/null || { echo 'node unavailable' >&2; exit 69; }
TENANT="${CONTROL12_MCP_TENANT:-default}"
WORKSPACE="${CONTROL12_MCP_WORKSPACE:-default}"

# Re-add/update the local STDIO MCP server using only bounded CONTROL12 tools.
copilot mcp remove control12 >/dev/null 2>&1 || true
copilot mcp add control12 \
  --tools 'control12_workspace_status,control12_memory_read,control12_validation_status,control12_research_propose,control12_artifact_propose' \
  --env "CONTROL12_WORKSPACE_ROOT=${CONTROL12_WORKSPACE_ROOT:-$HOME/.control12/workspaces}" \
  --env "CONTROL12_MCP_TENANT=$TENANT" \
  --env "CONTROL12_MCP_WORKSPACE=$WORKSPACE" \
  --env "CONTROL12_REPO_DIR=$ROOT" \
  -- node "$ROOT/control12-mcp/src/server.mjs"

echo 'CONTROL12 MCP installed for Copilot CLI.'
echo 'Use: copilot mcp list'
