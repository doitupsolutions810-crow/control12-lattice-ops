# Security policy

## Secrets

Do not place API keys, service-role credentials, GitHub tokens, private signing keys, or Wolfram App IDs in source files, commits, issues, logs, screenshots, or chat messages.

If a secret is exposed, revoke it immediately and replace it through the provider's secure secret-management flow. Avrone intentionally fails closed when a required connector secret is missing.

## Constitutional controls

External connectors are advisory and cannot authorize execution. Privileged actions require constitutional review, human approval, bounded execution, evidence generation, and rollback or containment.

## Reporting

Record vulnerabilities as private security reports or through a restricted operator channel. Do not include live credentials or sensitive tenant data in reports.
