# Elite Estimating — Launch Readiness Gates

Elite Estimating is designed as a provider-neutral, multi-vertical estimating platform. A deployment is not considered production-ready until every gate below is satisfied.

## Code gates

- Strict TypeScript typecheck passes.
- Unit tests pass for estimating math, safety evidence, RBAC, provider routing, pricing normalization, and approval governance.
- Container image builds and starts successfully.
- `/health` returns 200.
- `/ready` returns 200 only with valid authentication configuration and healthy durable storage (unless explicitly running ephemeral development mode).
- PostgreSQL migrations apply cleanly from an empty database.
- No high-severity production dependency vulnerabilities.
- Tenant isolation tests pass.
- Estimate approval rejects missing provenance, missing safety-critical procedure references, invalid AI confidence, unapproved lines, and blocking carrier rules.

## Data and licensing gates

- No proprietary estimating database may be copied, scraped, or redistributed without rights.
- Every provider must be classified as owned, licensed, public, or customer-provided.
- Production credentials must be tenant-scoped where required and stored outside the repository.
- OEM repair procedure, labor, parts, valuation, ADAS, diagnostics, property pricing, catastrophe/weather, and regulatory sources require documented legal use rights before activation.
- Provider failures must degrade gracefully without silently substituting unsupported data.

## Enterprise gates

- Durable PostgreSQL storage configured.
- Append-only audit events enabled.
- Authentication secret or enterprise identity provider configured.
- TLS termination enabled.
- Backups and point-in-time recovery configured for production database.
- Centralized logs, alerting, uptime monitoring, rate limiting, and incident response contacts configured.
- Data retention, privacy, and regional residency policies defined per tenant/jurisdiction.
- Carrier-specific estimate rules tested before activation.

## Product gates

- Browser workspace can create, scope, calculate, review, and approve estimates.
- Revision/supplement workflow tested.
- Required OEM/ADAS/structural evidence is surfaced before approval.
- At least one licensed production provider is connected for each marketed data capability.
- Import/export adapters are validated against the target standard/provider version before being advertised as compatible.
- Mobile inspection/photo workflows are integrated before mobile inspection is marketed as production-ready.

## External actions still required before public carrier launch

1. Provision production PostgreSQL and set `DATABASE_URL`.
2. Generate and securely set `ELITE_AUTH_SECRET` (minimum 32 characters) or replace HS256 with the selected enterprise OIDC/SSO configuration.
3. Run `npm run build` followed by `npm run migrate` against the production database.
4. Obtain and configure licensed data-provider credentials.
5. Complete legal review of data licenses, terms, privacy, and insurance-industry regulatory obligations for target jurisdictions.
6. Configure production hosting, DNS, TLS, backups, monitoring, alerting, and rate limiting.
7. Execute carrier acceptance tests using representative auto, property, heavy-equipment, marine/RV/motorcycle and specialty estimates.
8. Perform independent security testing before broad enterprise rollout.

A green codebase is necessary but is not sufficient to claim global production readiness without the external data rights, credentials, infrastructure, and acceptance testing above.
