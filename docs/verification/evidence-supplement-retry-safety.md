# Evidence + Supplement Retry Safety Verification

This verification branch exists only to run the production CI workflow against current `main` after:

- retry-safe evidence registration by source identity,
- evidence conflict detection for changed binary identity,
- concurrent duplicate evidence resolution,
- deterministic supplement creation IDs,
- normalized duplicate supplement persistence errors, and
- durable idempotent supplement creation service/tests.

The branch must pass strict typecheck/tests, production dependency audit, PostgreSQL migrations/readiness, and production Docker build before the batch is considered verified.
