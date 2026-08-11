#!/usr/bin/env bash
set -euo pipefail

ENGINE="${CONTROL12_CONTAINER_ENGINE:-podman}"
WORKSPACE_ROOT="${CONTROL12_WORKSPACE_ROOT:-${HOME}/.control12/workspaces}"
IMAGE="${1:?usage: run-workspace-container.sh IMAGE TENANT WORKSPACE [COMMAND...] }"
TENANT="${2:?tenant required}"
WORKSPACE="${3:?workspace required}"
shift 3

[[ "$TENANT" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || { echo "invalid tenant" >&2; exit 64; }
[[ "$WORKSPACE" =~ ^[A-Za-z0-9._-]{1,128}$ ]] || { echo "invalid workspace" >&2; exit 64; }
command -v "$ENGINE" >/dev/null || { echo "container engine unavailable: $ENGINE" >&2; exit 69; }

mkdir -p "$WORKSPACE_ROOT"
ROOT="$(cd "$WORKSPACE_ROOT" && pwd -P)"
TARGET="$ROOT/$TENANT/$WORKSPACE"
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd -P)"
case "$TARGET" in "$ROOT"/*) ;; *) echo "workspace escape denied" >&2; exit 77 ;; esac

CMD=("$@")
if [[ ${#CMD[@]} -eq 0 ]]; then
  CMD=("/bin/sh" "-lc" "find /workspace -maxdepth 2 -type f -print | sort | head -100")
fi

exec "$ENGINE" run --rm \
  --name "control12-${TENANT}-${WORKSPACE}-$$" \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 128 \
  --memory "${CONTROL12_CONTAINER_MEMORY:-512m}" \
  --cpus "${CONTROL12_CONTAINER_CPUS:-1.0}" \
  --user "${CONTROL12_CONTAINER_UID_GID:-65532:65532}" \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=128m \
  --mount "type=bind,src=$TARGET,dst=/workspace,rw" \
  --workdir /workspace \
  "$IMAGE" "${CMD[@]}"
