# Integration + Provider Resilience Verification

This branch verifies current main after adding:

- tenant-scoped, idempotent lifecycle outbox events for estimates and supplements
- PostgreSQL outbox persistence and readiness gating
- supplement domain/UI alignment fixes
- provider circuit breaker health state and controlled recovery
- federated gateway circuit-breaker routing
- regression tests for outbox idempotency and provider recovery

The complete production smoke gate includes PostgreSQL migrations, strict tests, dependency audit, live readiness/health checks and Docker image build.

Verification rerun: strict optional-state and supplement-domain fixes included.
