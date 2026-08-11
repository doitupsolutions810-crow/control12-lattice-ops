#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_ROOT="${CONTROL12_REPO_ROOT:-$HOME/control12-lattice-ops}"
ROOT="$(git -C "$EXPECTED_ROOT" rev-parse --show-toplevel 2>/dev/null || true)"

if [ "$ROOT" != "$EXPECTED_ROOT" ]; then
  echo "ERROR: expected canonical repository root at $EXPECTED_ROOT" >&2
  echo "Resolved root: ${ROOT:-none}" >&2
  exit 1
fi

nested="$(find "$ROOT" -mindepth 2 -type d -name .git -print 2>/dev/null || true)"
dirty="$(git -C "$ROOT" status --porcelain=v1)"

printf 'Repository root: %s\n' "$ROOT"
printf 'Branch: %s\n' "$(git -C "$ROOT" branch --show-current)"
printf 'HEAD: %s\n' "$(git -C "$ROOT" rev-parse HEAD)"
printf 'Dirty entries: %s\n' "$(printf '%s\n' "$dirty" | sed '/^$/d' | wc -l | tr -d ' ')"

if [ -n "$nested" ]; then
  echo "ERROR: nested Git repositories detected:" >&2
  printf '%s\n' "$nested" >&2
  exit 1
fi

git -C "$ROOT" fsck --no-dangling
git -C "$ROOT" diff --check

if [ -n "$dirty" ]; then
  echo "NOTICE: working tree has local changes"
  printf '%s\n' "$dirty"
fi

echo "PASS: workspace integrity verified"
