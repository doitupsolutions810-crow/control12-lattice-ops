# System success checklist (keep it simple)

Goal: dependency updates open and merge safely. Config is already in the repo. You only need a few account settings.

## Success looks like

1. A **Renovate** workflow run finishes **green** (not `startup_failure`).
2. A **Dependency Dashboard** issue appears (or update PRs from the bot).
3. Small (patch) updates can merge after checks pass.

## Do these in order

### 1. Turn on Actions (required — this was blocking runs)

Repo → **Settings → Actions → General**

- Allow Actions to run
- Prefer **Allow all actions and reusable workflows**
- Workflow permissions: **Read and write**
- Enable **Allow GitHub Actions to create and approve pull requests**

Private repos also need Actions minutes available under account **Billing**.

### 2. Install the GitHub App on this repo

Permissions:

- Contents: Read and write
- Pull requests: Read and write
- Issues: Read and write
- Workflows: Read and write
- Metadata: Read-only
- Dependabot alerts: Read-only (optional)

### 3. Add two secrets

Repo → **Settings → Secrets and variables → Actions**

| Secret | Value |
|--------|--------|
| `APP_CLIENT_ID` | App **Client ID** |
| `APP_PRIVATE_KEY` | Full private key PEM (including BEGIN/END lines) |

### 4. Run Renovate once

Actions → **Renovate** → **Run workflow**

or:

```bash
gh workflow run renovate.yml -R doitupsolutions810-crow/control12-lattice-ops
```

Open the run. You want jobs to start and finish successfully.

### 5. Optional: let the bot merge without a human review

**Settings → Rules → Rulesets** (protect `main`):

- **Ruleset A — checks:** require CI status checks; no bot bypass
- **Ruleset B — reviews:** require 1 approval for humans; add your **Renovate App** with bypass **For pull requests only**

Humans still need review. The bot can merge after CI is green.

### 6. Optional: npm publish

On the npm package, Trusted Publisher:

- Repository: this repo
- Workflow: `release.yml`
- Environment: `release`

## If something fails

| What you see | Fix |
|--------------|-----|
| `startup_failure`, no jobs | Step 1 (Actions) or billing |
| Secret / token errors | Steps 2–3 (App install + secrets) |
| PR needs review forever | Step 5 (App bypass on reviews only) |
| Duplicate Dependabot + Renovate PRs | Set Dependabot `open-pull-requests-limit` to `0`; keep security updates on |

## Already in the repo

- `renovate.json` — update rules and automerge windows
- `.github/workflows/renovate.yml` — self-hosted Renovate
- `.github/workflows/ci.yml` — tests
- `.github/workflows/release.yml` — npm publish
- `.github/dependabot.yml` — backup version updates

No more config files are required for basic success—only the settings above.
