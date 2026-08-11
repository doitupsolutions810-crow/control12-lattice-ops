#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${CONTROL12_REPO_DIR:-$HOME/control12-lattice-ops}"
REMOTE="${CONTROL12_GIT_REMOTE:-origin}"
BRANCH="${CONTROL12_RECONCILE_BRANCH:-feature/chat-workspace-fabric-v5}"
STATE_DIR="${CONTROL12_RECONCILER_STATE_DIR:-$HOME/.control12/reconciler}"
LOCK_DIR="$STATE_DIR/lock"
LOG_FILE="$STATE_DIR/reconciler.log"
LAST_GOOD="$STATE_DIR/last-good.sha"
VALIDATOR="${CONTROL12_VALIDATOR:-scripts/validate-chat-fabric.sh}"
PROMOTE_CMD="${CONTROL12_STAGING_PROMOTE_CMD:-}"

mkdir -p "$STATE_DIR"
exec >>"$LOG_FILE" 2>&1
printf '[%s] reconcile start\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "reconcile already running; exiting"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

for cmd in git bash; do
  command -v "$cmd" >/dev/null || { echo "missing required command: $cmd" >&2; exit 69; }
done

test -d "$REPO_DIR/.git" || { echo "repository not found: $REPO_DIR" >&2; exit 66; }
cd "$REPO_DIR"

git fetch --prune "$REMOTE" "$BRANCH"
REMOTE_SHA="$(git rev-parse "$REMOTE/$BRANCH")"
LOCAL_SHA="$(git rev-parse HEAD)"
LAST_GOOD_SHA="$(cat "$LAST_GOOD" 2>/dev/null || true)"

if [[ "$REMOTE_SHA" == "$LOCAL_SHA" && "$REMOTE_SHA" == "$LAST_GOOD_SHA" ]]; then
  echo "already validated: $REMOTE_SHA"
  exit 0
fi

# Keep the reconciler deterministic: never merge local changes into the desired state.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree is dirty; refusing destructive reconciliation" >&2
  exit 75
fi

git checkout --detach "$REMOTE_SHA"

if ! bash "$VALIDATOR"; then
  echo "validation failed for $REMOTE_SHA; promotion denied" >&2
  exit 1
fi

printf '%s\n' "$REMOTE_SHA" > "$LAST_GOOD"
echo "validated revision: $REMOTE_SHA"

if [[ -n "$PROMOTE_CMD" ]]; then
  echo "running configured staging promotion command"
  CONTROL12_VALIDATED_SHA="$REMOTE_SHA" bash -lc "$PROMOTE_CMD"
else
  echo "no staging promotion command configured; validation only"
fi

printf '[%s] reconcile complete sha=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$REMOTE_SHA"
