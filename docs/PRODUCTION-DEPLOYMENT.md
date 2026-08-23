# Production Deployment and Rollback

Elite Estimating production deployment is manual, evidence-gated, and container-based. The verified application Dockerfile remains the source of truth. Cloudflare Workers + Containers provide the edge/runtime adapter; PostgreSQL is the shared durable state plane and R2 is the evidence blob store. Application and deployment tooling require Node.js 22 or newer; the production Docker image currently uses Node 22 LTS.

## Production GitHub environment

The production workflows target a GitHub Environment named `production`. You can create it manually under **Settings → Environments**, or run **Actions → Diagnose Elite Estimating Production Setup** once: GitHub creates an environment referenced by a workflow if it does not already exist. Configure environment protection/approvals afterward if available for the repository plan.

Before attempting a deploy, use **Actions → Diagnose Elite Estimating Production Setup → Run workflow**. This workflow does not deploy anything. It reports missing environment-secret names in the GitHub job summary without printing secret values, optionally validates the production HTTPS origin, and runs the real launch-certification checker when the secret inventory is complete.

## Generate the application-owned secrets

Three production secrets are application-owned and can be generated safely instead of invented manually:

```bash
npm run production:secrets
```

Run that command only on a trusted local machine/terminal. It prints new random values for `ELITE_AUTH_SECRET`, `ELITE_METRICS_TOKEN`, and `ELITE_CLAIMS_WEBHOOK_SECRET`. Paste those values directly into **Settings → Environments → production → Environment secrets** and do not save or commit the output. If the output is exposed in terminal history, logs, screenshots, or chat, regenerate all three values.

The helper deliberately does **not** generate Cloudflare, PostgreSQL, R2, Claims webhook URL, or launch-manifest values because those must correspond to real provisioned resources, ownership, licenses, and approvals.

## Required GitHub production secrets

Configure these values as GitHub Environment secrets, never repository files:

- `CLOUDFLARE_API_TOKEN` — scoped Cloudflare token capable of deploying the target Worker/Containers application.
- `CLOUDFLARE_ACCOUNT_ID` — target Cloudflare account ID.
- `DATABASE_URL` — production PostgreSQL connection URL. Non-local production databases must require TLS with `sslmode=require`, `sslmode=verify-ca`, or preferably `sslmode=verify-full` when the provider supports hostname/certificate verification. A remote PostgreSQL URL without one of these modes cannot pass `launch:check`.
- `ELITE_AUTH_SECRET` — production service-token secret, minimum 32 characters.
- `ELITE_METRICS_TOKEN` — protected metrics bearer token, minimum 32 characters.
- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `ELITE_CLAIMS_WEBHOOK_URL` — HTTPS endpoint owned by Claims Management.
- `ELITE_CLAIMS_WEBHOOK_SECRET` — webhook signing secret, minimum 32 characters.
- `ELITE_LAUNCH_MANIFEST_JSON` — the complete validated launch evidence manifest for the market being launched.

GitHub environment secrets can be added in the web UI under **Settings → Environments → production → Environment secrets**, or with GitHub CLI using `gh secret set --env production SECRET_NAME`. Secret values must never be committed to this repository.

The deployment workflow refuses to run when a required secret is absent. `deploy/cloudflare/wrangler.jsonc` also declares the Worker runtime secret contract so Wrangler independently rejects incomplete Worker secret configuration.

## Launch evidence manifest

Start from `launch/launch-manifest.example.json`, but do not reuse its placeholder approvals. The production manifest must contain real references for validated market and asset classes; lawful data-rights/provider agreements; approved structural, restraint, ADAS, and EV/HV safety coverage; privacy review; security review; validated pilot evidence; backup/restore evidence; and business-approved RPO/RTO.

`npm run launch:check -- <manifest.json>` must return green in the production environment before deploy.

## Production deploy

Use **Actions → Deploy Elite Estimating Production → Run workflow**. Supply a clean public HTTPS origin and type `DEPLOY` for confirmation.

The workflow validates inputs/secrets, verifies the application and dependency audit, certifies the real launch manifest including secure PostgreSQL transport, typechecks the Cloudflare adapter, builds the production Docker image, syncs Worker secrets through a temporary mode-`0600` bundle, deploys Worker + Containers, deletes temporary secret material, polls public `/ready`, and finally performs the authenticated remote create → replay → read → void smoke.

A successful `wrangler deploy` alone is not treated as launch success. Public readiness and authenticated lifecycle verification must also pass.

## Rollback

Use **Actions → Roll Back Elite Estimating Production → Run workflow** only with a previously verified immutable 40-character Git commit SHA and only after explicitly confirming that revision is compatible with the current production PostgreSQL schema. The rollback rebuilds the historical Docker image, redeploys the matching Worker/container pair, verifies public readiness, and runs an authenticated lifecycle smoke after restoration.

Schema migrations are forward-only unless a separately reviewed recovery plan explicitly says otherwise. Restoring an older database snapshot is a disaster-recovery operation, not a normal application rollback.

## What still requires human/external authorization

The repository cannot manufacture or self-approve Cloudflare account authorization/API scope, production PostgreSQL provisioning and credentials, R2 bucket credentials, production DNS ownership, Claims Management webhook ownership, data-provider/OEM licensing agreements, privacy/security approvals, market pilot evidence, or production RPO/RTO acceptance.

Until those are real and `launch:check` is green, software readiness must not be represented as market launch authorization.
