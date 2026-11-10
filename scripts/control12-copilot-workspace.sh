#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="${CONTROL12_WORKSPACE_ROOT:-$HOME/.control12/workspaces}"
TENANT="${1:?usage: control12-copilot-workspace.sh TENANT WORKSPACE PROMPT}"
WORKSPACE="${2:?workspace required}"
PROMPT="${3:?prompt required}"

[[ "$TENANT" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || { echo "invalid tenant" >&2; exit 64; }
[[ "$WORKSPACE" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || { echo "invalid workspace" >&2; exit 64; }
[[ "$TENANT" != "." && "$TENANT" != ".." ]] || { echo "invalid tenant" >&2; exit 64; }
[[ "$WORKSPACE" != "." && "$WORKSPACE" != ".." ]] || { echo "invalid workspace" >&2; exit 64; }
command -v copilot >/dev/null || { echo "GitHub Copilot CLI not installed" >&2; exit 69; }

mkdir -p "$WORKSPACE_ROOT"
ROOT="$(cd "$WORKSPACE_ROOT" && pwd -P)"
TARGET="$ROOT/$TENANT/$WORKSPACE"
case "$TARGET" in "$ROOT"/*) ;; *) echo "workspace escape denied" >&2; exit 77 ;; esac
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd -P)"
case "$TARGET" in "$ROOT"/*) ;; *) echo "workspace symlink escape denied" >&2; exit 77 ;; esac

cd "$TARGET"

# Programmatic Copilot is intentionally constrained to this workspace.
# Broad path, URL, tool, and unattended execution grants are prohibited.
exec copilot \
  -p "$PROMPT" \
  -s \
  --no-ask-user \
  --allow-tool='read,write' \
  --deny-tool='shell(git push)' \
  --deny-tool='shell(kubectl:*)' \
  --deny-tool='shell(terraform:*)' \
  --deny-tool='shell(aws:*)' \
  --deny-tool='shell(ssh:*)' \
  --deny-tool='shell(sudo:*)'
