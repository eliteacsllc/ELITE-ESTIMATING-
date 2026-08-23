# Lifecycle Outbox Verification

This branch verifies current main after adding the tenant-scoped, idempotent lifecycle outbox used to integrate Elite Estimating with Claims Management and other systems without sharing databases.

The production smoke gate covers the new outbox migration, strict tests, dependency audit, PostgreSQL readiness, live server readiness and Docker image build.
