# Security Policy

## Supported branch

Security fixes are applied to `main`. Production deployments must use a commit that has passed the repository's required CI and launch-certification gates.

## Reporting a vulnerability

Do **not** disclose suspected vulnerabilities, credentials, customer data, exploit details, or production infrastructure information in public issues, pull requests, discussions, commits, or logs.

Use GitHub's private vulnerability reporting / Security Advisories for this repository when available. If private reporting is unavailable, contact the repository owner through a private, authenticated business channel and include only the minimum information needed to reproduce the issue.

## Secrets

Never commit or paste production secrets. Production credentials belong in the GitHub `production` Environment or the designated secret manager. Rotate any credential immediately if exposure is suspected.

## Response expectations

1. Triage severity and affected surfaces.
2. Reproduce safely without production customer data.
3. Patch on an isolated branch.
4. Run strict typecheck/tests, dependency audit, database and edge smoke tests, and production-container build.
5. Rotate affected secrets and invalidate compromised sessions/tokens when applicable.
6. Deploy through the controlled production workflow.
7. Preserve an audit record and post-incident corrective actions.

## Production safety boundary

A green software CI run is not equivalent to global launch approval. Production launch also requires the external evidence and infrastructure tracked by the production launch checklist, including licensed data rights, safety-source approvals, privacy/security review, controlled pilot evidence, recovery objectives, and real production resources.
