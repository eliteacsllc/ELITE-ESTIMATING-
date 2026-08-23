# Production Deployment and Rollback

Elite Estimating production deployment is manual, evidence-gated, and container-based. The verified application Dockerfile remains the source of truth. Cloudflare Workers + Containers provide the edge/runtime adapter; PostgreSQL is the shared durable state plane and R2 is the evidence blob store.

## Production GitHub environment

Create a GitHub Environment named `production`. Configure environment protection/approvals if available for the repository plan. The deploy and rollback workflows both target this environment.

## Required GitHub production secrets

Configure these values as GitHub Environment secrets, never repository files:

- `CLOUDFLARE_API_TOKEN` — scoped Cloudflare token capable of deploying the target Worker/Containers application.
- `CLOUDFLARE_ACCOUNT_ID` — target Cloudflare account ID.
- `DATABASE_URL` — production PostgreSQL connection URL.
- `ELITE_AUTH_SECRET` — production service-token secret, minimum 32 characters. Enterprise OIDC can replace this only after the deployment adapter and launch gate are updated for the OIDC-only secret contract.
- `ELITE_METRICS_TOKEN` — protected metrics bearer token, minimum 32 characters.
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `ELITE_CLAIMS_WEBHOOK_URL` — HTTPS endpoint owned by Claims Management.
- `ELITE_CLAIMS_WEBHOOK_SECRET` — webhook signing secret, minimum 32 characters.
- `ELITE_LAUNCH_MANIFEST_JSON` — the complete validated launch evidence manifest for the market being launched.

The deployment workflow refuses to run when a required secret is absent. `deploy/cloudflare/wrangler.jsonc` also declares the Worker runtime secret contract so Wrangler independently rejects incomplete Worker secret configuration.

## Launch evidence manifest

Start from `launch/launch-manifest.example.json`, but do not reuse its placeholder approvals. The production manifest must contain real references for:

- validated market and asset classes;
- lawful data-rights/provider agreements;
- approved structural, restraint, ADAS, and EV/HV safety coverage;
- privacy review;
- security review;
- validated pilot evidence;
- backup/restore evidence;
- business-approved RPO/RTO.

`npm run launch:check -- <manifest.json>` must return green in the production environment before deploy.

## Production deploy

Use **Actions → Deploy Elite Estimating Production → Run workflow**.

Inputs:

- `production_url`: the public HTTPS base URL that will serve Elite Estimating.
- `confirmation`: must equal `DEPLOY`.

The workflow performs, in order:

1. required-secret validation;
2. application install, strict verification, and production dependency audit;
3. real launch-manifest certification;
4. Cloudflare adapter install and typecheck;
5. local build of the exact production Docker image;
6. temporary secret-bundle creation with mode `0600`;
7. Cloudflare Worker secret synchronization;
8. Worker + Containers deployment with immediate container rollout;
9. temporary secret-bundle deletion;
10. repeated public `/ready` checks until the deployment reports ready or the gate fails.

A successful `wrangler deploy` alone is not treated as launch success. The workflow requires public `/ready` HTTP 200 plus `status=ready`, `rateLimitDurable=true`, and `rateLimitHealthy=true`.

## Rollback

Cloudflare Worker rollback by itself is not sufficient for this application because Worker activation and container image rollout are separate concerns, and older application code may not be compatible with a newer PostgreSQL schema.

Use **Actions → Roll Back Elite Estimating Production → Run workflow** only with a previously verified Git commit or tag.

Inputs:

- `git_ref`: known-good commit SHA or tag.
- `production_url`: public production base URL.
- `database_compatibility`: must equal `DB-COMPATIBLE` after a human confirms the target revision can run against the current production schema.
- `confirmation`: must equal `ROLLBACK`.

The rollback workflow checks out the target source, reruns application verification, typechecks the target Cloudflare adapter, rebuilds the old Docker image, redeploys the Worker/container pair, and verifies public readiness.

## Database rollback policy

Schema migrations are forward-only unless a separately reviewed recovery plan explicitly says otherwise. Do not automatically reverse production PostgreSQL migrations during an application rollback. Restoring an older database snapshot is a disaster-recovery operation, not a normal application rollback, and may discard post-snapshot production data.

## First production deployment

Cloudflare may make the Worker URL reachable before the first container application has finished provisioning. The release workflow therefore polls `/ready` after deployment rather than assuming the Worker becoming reachable means the application is usable.

## What still requires human/external authorization

The repository cannot manufacture or self-approve:

- Cloudflare account authorization and API token scope;
- production PostgreSQL provisioning and credentials;
- R2 bucket/credential provisioning;
- production DNS/custom-domain ownership;
- Claims Management production webhook ownership;
- data-provider/OEM licensing agreements;
- privacy/security approvals;
- market pilot approval evidence;
- production RPO/RTO acceptance.

Until those are real and `launch:check` is green, software readiness must not be represented as market launch authorization.
