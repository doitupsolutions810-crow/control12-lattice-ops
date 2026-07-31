# GitHub App setup for Renovate

Create or reuse a GitHub App installed on this repository with these repository permissions:

- Contents: Read and write
- Pull requests: Read and write
- Issues: Read and write
- Workflows: Read and write
- Dependabot alerts: Read-only
- Metadata: Read-only

Add these repository secrets:

- `APP_CLIENT_ID`: the GitHub App client ID
- `APP_PRIVATE_KEY`: the complete PEM private key, including the BEGIN/END lines

The npm package must separately configure GitHub Actions Trusted Publishing with:

- Repository: this repository
- Workflow filename: `release.yml`
- Environment: `release`
- Allowed action: `npm publish`

Renovate and Dependabot are both enabled for npm and GitHub Actions. This is intentional redundancy, but it can produce duplicate update pull requests. To use Renovate as the sole version-update engine, set each Dependabot `open-pull-requests-limit` to `0` while leaving Dependabot security updates enabled.
