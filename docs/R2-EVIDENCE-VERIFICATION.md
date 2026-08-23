# R2 Evidence Storage Verification

This branch verifies current `main` after adding:

- Cloudflare R2 / S3-compatible presigned upload and download support
- SHA-256-bound upload intents
- checksum verification before evidence registration
- tenant-scoped evidence downloads
- production readiness gating with `ELITE_REQUIRE_BLOB_STORAGE`
- current aligned AWS SDK v3 dependencies
- regression tests using a mock blob store without live cloud credentials

The production gate must pass strict TypeScript/tests, dependency audit, PostgreSQL migrations, live readiness/health, and Docker image build.
