# Cloudflare Containers deployment adapter

This adapter deploys the verified root `Dockerfile` behind a Cloudflare Worker without rewriting the Elite Estimating application runtime.

## Architecture

- Cloudflare Worker receives public HTTP traffic.
- `getRandom()` routes across two stateless `EliteEstimatingContainer` instances.
- Both containers share the production PostgreSQL database, including distributed rate-limit buckets and idempotency state.
- Evidence remains in Cloudflare R2 through the application's existing S3-compatible R2 client.
- Worker Secrets are injected into the container only at runtime.
- `startAndWaitForPorts()` blocks forwarding until port 8787 is accepting traffic.

## Required Worker Secrets

Set these with `wrangler secret put <NAME>` from this directory; never commit values:

`DATABASE_URL`, `ELITE_METRICS_TOKEN`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ELITE_CLAIMS_WEBHOOK_URL`, `ELITE_CLAIMS_WEBHOOK_SECRET`.

Authentication also requires either `ELITE_AUTH_SECRET` or the OIDC set `ELITE_OIDC_ISSUER`, `ELITE_OIDC_AUDIENCE`, and `ELITE_OIDC_JWKS_URL`. OIDC is preferred for enterprise production.

## Before deployment

1. Provision production PostgreSQL and run the root migrations through `009_rate_limit_buckets.sql` or later.
2. Provision the R2 bucket and scoped R2 API credentials.
3. Configure Claims Management HTTPS webhook delivery and secret.
4. Configure identity, metrics, and all required Worker Secrets.
5. Complete a market evidence manifest and run the root `npm run launch:check -- <manifest.json>` with production environment values.
6. Run `npm install` and `npm run check` in this directory.
7. Run `npm run deploy` only after the launch checker is GREEN for the intended market.
8. After deployment, verify `/ready`, `/health`, authenticated mutation idempotency, evidence upload/download, webhook delivery, and backup/restore evidence.

A successful Cloudflare deployment is not itself launch certification. The launch evidence manifest remains authoritative for market readiness.
