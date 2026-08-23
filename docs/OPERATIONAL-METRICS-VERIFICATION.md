# Operational Metrics Verification

This branch verifies current `main` after adding:

- low-cardinality Prometheus HTTP metrics
- normalized route labels with entity identifiers removed
- in-flight request tracking
- request counts by method/route/status class
- request latency histograms including correct +Inf totals
- protected `/metrics` endpoint gated by a dedicated token
- readiness visibility for metrics configuration
- regression tests preventing identifier leakage

The production gate must pass strict TypeScript/tests, dependency audit, PostgreSQL migrations, live readiness/health, and Docker image build.
