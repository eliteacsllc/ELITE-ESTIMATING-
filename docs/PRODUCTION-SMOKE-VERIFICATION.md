# Production Smoke Verification

This branch verifies the current `main` branch using the strengthened CI gates:

- strict TypeScript validation and regression tests
- production dependency vulnerability audit
- PostgreSQL service boot
- schema migration execution
- production server startup
- `/ready` and `/health` smoke checks
- production Docker image build

The branch contains no alternate production code; it exists to expose an observable pull-request run for the current production candidate.
