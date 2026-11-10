# CONTROL12 Reconciler + Copilot CLI Integration

## Goal

Keep CONTROL12 operational when GitHub Actions or GitHub-hosted runners are unavailable. GitHub remains source control; the CONTROL12 host becomes the validation executor. Copilot CLI is an optional coding engine inside a confined workspace and never becomes the deployment authority.

## Reconciler

Run once:

```bash
CONTROL12_REPO_DIR="$HOME/control12-lattice-ops" \
CONTROL12_RECONCILE_BRANCH="feature/chat-workspace-fabric-v5" \
bash scripts/control12-reconciler.sh
```

The reconciler:

1. fetches the configured branch;
2. refuses to overwrite a dirty working tree;
3. checks out the exact remote commit in detached-head mode;
4. runs `scripts/validate-chat-fabric.sh`;
5. records the last validated SHA only after PASS;
6. optionally invokes `CONTROL12_STAGING_PROMOTE_CMD` with `CONTROL12_VALIDATED_SHA` set.

No production promotion is built into the reconciler. A separate v5 policy/admission path must authorize production.

## macOS launchd

Copy `launchd/com.control12.reconciler.plist.example` to a user-specific plist, replace `__HOME__` and `__CONTROL12_REPO__`, then load it with launchd. The template polls once per minute.

## Copilot CLI

GitHub Copilot CLI supports non-interactive prompts using `-p`, quiet output using `-s`, and granular tool permissions. CONTROL12 uses those restrictions rather than `--allow-all`.

Example:

```bash
bash scripts/control12-copilot-workspace.sh \
  default \
  demo-workspace \
  "Inspect this workspace and improve the test coverage without touching deployment configuration."
```

The adapter:

- runs with the selected CONTROL12 workspace as the current directory;
- permits file reads and writes inside the current workspace;
- does not pass `--allow-all`, `--allow-all-paths`, or `--allow-all-urls`;
- explicitly denies `git push`, `kubectl`, `terraform`, `aws`, `ssh`, and `sudo` shell operations;
- does not provide production credentials.

For interactive use, run `copilot` manually from the workspace and review requested permissions. Do not globally enable `--allow-all` for the CONTROL12 host.

## Authentication

On the Mac, authenticate Copilot CLI interactively with:

```bash
copilot login
```

or start `copilot` and use `/login`.

Do not copy the Mac's Copilot credential store to servers. For a future headless server, provision a supported short-lived/managed credential separately and keep it outside model context and workspace files.

## Success boundary

A GitHub Actions outage is classified as degraded CI, not CONTROL12 failure, when all of the following remain true:

- the repo can be fetched;
- local validation passes;
- workspace isolation holds;
- Copilot is restricted to workspace coding authority;
- staging promotion is separately configured;
- production still requires v5 admission.
