# Integration Health Verification

This branch verifies current `main` after adding:

- aggregate lifecycle outbox health snapshots
- pending/retried/exhausted/oldest-age operational metrics
- explicit outbox health availability metric
- configurable readiness policies for backlog, age and exhausted deliveries
- provider circuit-state metric rendering without tenant/claim/VIN labels
- readiness failure when outbox health itself cannot be read
- regression tests for thresholds, privacy and provider metrics

The production gate must pass strict TypeScript/tests, dependency audit, PostgreSQL migrations, live readiness/health, and Docker image build.
