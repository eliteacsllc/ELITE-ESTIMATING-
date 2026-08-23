# Elite Estimating Production Launch Runbook

This runbook separates repository readiness from external market readiness. A green CI build proves the software artifact; it does not grant data licenses, configure production identity, or approve a jurisdiction for launch.

## 1. Required production inputs

Before a production market may be marked GREEN, supply and verify:

- a production PostgreSQL connection with backups, point-in-time recovery or equivalent recovery controls
- a unique `ELITE_AUTH_SECRET` while service-token auth remains enabled
- enterprise OIDC/SSO configuration before enterprise user rollout
- Claims Management webhook URL and a unique webhook signing secret when event delivery is enabled
- licensed provider credentials for each data capability used in that market
- domain/TLS configuration
- privacy, retention and data-processing configuration for the launch jurisdiction
- commercial terms and provider pass-through costs

Never place live secrets in source control.

## 2. Build and migrate

The same artifact must pass CI before promotion:

1. strict TypeScript typecheck
2. regression tests
3. high-severity production dependency audit
4. PostgreSQL service boot
5. all schema migrations
6. live `/ready` and `/health` checks
7. production Docker image build

For a Docker Compose production-parity test, set `POSTGRES_PASSWORD` and `ELITE_AUTH_SECRET`, then run the stack. The migration service must complete successfully before the app is considered ready.

## 3. Data provider onboarding

A provider is allowed into a production market only when all of the following are documented:

- provider and contract owner
- licensed capabilities
- allowed asset classes
- allowed regions/jurisdictions
- tenant credential model
- redistribution/display restrictions
- cache/retention restrictions
- source/provenance mapping
- SLA and expected latency
- fallback provider or documented no-data behavior

The provider circuit breaker must remain enabled. A provider failure must degrade that capability rather than block unrelated estimate functions.

## 4. Security and identity

Production requirements:

- HTTPS only
- secrets in the hosting platform secret store
- tenant isolation verified
- RBAC role matrix verified
- service tokens rotated and scoped
- enterprise SSO cryptographically verified before SSO is advertised as available
- no unverified identity headers trusted from the public internet
- audit events append-only under the production database role model
- lifecycle webhooks signed and idempotent

## 5. Claims Management integration

Elite Estimating owns estimate calculations, revisions, evidence gates and supplements. Claims Management owns claim workflow, assignment, dispatch and downstream claim state.

Lifecycle events are written to `integration_outbox`. The dispatcher sends signed events using:

- `x-elite-event-id`
- `x-elite-event-topic`
- `x-elite-idempotency-key`
- `x-elite-signature`

The receiver must verify the HMAC signature, deduplicate by idempotency key, and return a non-2xx response when processing was not accepted. Failed deliveries remain unpublished and increment their attempt counter.

## 6. Pilot acceptance

Run a controlled pilot before global traffic. Minimum cases:

- passenger collision estimate
- commercial/heavy estimate
- safety-critical ADAS operation
- supplement add/replace/remove cycle
- carrier/reviewer approval path
- claim search/reopen/export
- provider outage/failover
- cross-tenant access denial
- invalid provenance rejection
- stale supplement rejection
- Claims Management event delivery retry

Every critical defect must be resolved or formally block that market.

## 7. Monitoring

Monitor at minimum:

- `/health` availability
- `/ready` readiness
- database connection failures/latency
- provider circuit states and latency
- outbox unpublished count and oldest event age
- webhook failure rate
- estimate approval failures by reason
- authentication failures
- HTTP 5xx rate and latency percentiles

Do not log raw secrets, full authorization headers or unnecessary customer PII.

## 8. Backup and recovery

Before launch:

- test a database restore into an isolated environment
- confirm migrations are replayable and versioned
- document backup frequency and retention
- preserve append-only audit/outbox history according to contractual and regulatory requirements

## 9. Rollback

If a release fails readiness, produces material estimating errors, breaks tenant isolation, or loses required provider evidence:

1. stop new traffic to the failing version
2. route to the last verified image
3. do not reverse a destructive schema migration blindly
4. isolate affected provider capability if the failure is provider-specific
5. preserve logs/audit/outbox records
6. reconcile any accepted estimates or events before reopening traffic

## 10. Market GREEN definition

A market is GREEN only when:

- software production smoke is green
- required provider data rights are green
- identity/security configuration is green
- privacy/regulatory review is green
- production infrastructure/backup is green
- Claims Management integration is green where enabled
- pilot acceptance is green
- commercial/pricing economics are green

Until all applicable gates are satisfied, the repository may be software-ready without being globally launch-ready.
