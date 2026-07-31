#!/usr/bin/env bash
set -euo pipefail

: "${APP_CLIENT_ID:?Set APP_CLIENT_ID to the GitHub App client ID}"
: "${APP_PRIVATE_KEY_FILE:?Set APP_PRIVATE_KEY_FILE to the PEM file path}"

if [[ ! -r "$APP_PRIVATE_KEY_FILE" ]]; then
  printf 'Private key file is not readable: %s\n' "$APP_PRIVATE_KEY_FILE" >&2
  exit 1
fi

command -v gh >/dev/null 2>&1 || {
  echo "GitHub CLI (gh) is required." >&2
  exit 1
}

gh auth status >/dev/null

repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq '.nameWithOwner')}"

printf '%s' "$APP_CLIENT_ID" | gh secret set APP_CLIENT_ID --repo "$repo" --body-file -
gh secret set APP_PRIVATE_KEY --repo "$repo" < "$APP_PRIVATE_KEY_FILE"

git push origin HEAD
printf 'Configured GitHub App secrets and pushed %s to %s.\n' "$(git rev-parse --short HEAD)" "$repo"
