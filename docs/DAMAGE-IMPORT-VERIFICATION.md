# Damage Graph + Import Verification

This branch verifies current `main` after adding:

- persistent tenant-scoped damage graphs by estimate revision
- stale-revision and safety-evidence validation
- damage graph API and readiness gating
- deterministic tenant/source import identity
- normalized local review state for imported estimates
- tenant-scoped import receipts
- migration `006_damage_graph.sql`
- migration `007_import_receipts.sql`
- regression tests for damage graph governance and import idempotency

The production gate must pass strict TypeScript/tests, dependency audit, PostgreSQL migrations, live `/ready` + `/health`, and Docker image build.
