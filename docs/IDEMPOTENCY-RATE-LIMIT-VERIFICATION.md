# Idempotency + Rate Limit Verification

This branch verifies current `main` after adding:

- durable mutation idempotency reservations
- canonical request hashing
- deterministic estimate identity for create retries
- rejection of Idempotency-Key reuse with a different live request
- optional production requirement for Idempotency-Key
- authenticated per-principal token-bucket limiting
- hashed rate-limit keys that do not expose tenant/user identifiers
- optional production readiness requirement for rate limiting
- migration `008_idempotency_receipts.sql`
- readiness verification of the actual idempotency receipt table
- regression tests for retries, tenant isolation, canonical hashing, and rate limiting

The production gate must pass strict TypeScript/tests, dependency audit, PostgreSQL migrations, live readiness/health, and Docker image build.
