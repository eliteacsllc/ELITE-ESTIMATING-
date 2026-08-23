# Optimistic Concurrency Verification

This branch exists only to verify current `main` after adding:

- optimistic `updatedAt` concurrency tokens for estimate saves,
- stale-write rejection in memory and PostgreSQL repositories,
- monotonic mutation timestamps,
- concurrency-aware estimate mutations,
- supplement application using the estimate concurrency token, and
- regression tests for stale writes and timestamp monotonicity.

The batch must pass strict tests, production dependency audit, PostgreSQL migrations/readiness, and the production Docker build.
