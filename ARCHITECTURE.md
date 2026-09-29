# Architecture

## Purpose

Elite Estimating is a standalone estimating system with portfolio integrations. Production boundaries must remain explicit so claims, mobile capture, QA, evidence, payments and external providers can fail independently without corrupting estimate state.

## Core components

- Client application: estimating UI and operator workflows.
- API/service layer: authenticated business operations, health/readiness and integration boundaries.
- Persistence: PostgreSQL-backed estimates, supplements, audit state and rate-limit state.
- Integration adapters: Claims Management, Damage IQ, Estimatics Library, Elite QA, EVN/dispatch and approved external providers.
- Deployment adapters: container/self-hosted and Cloudflare production deployment path.

## Trust boundaries

1. Browser/mobile clients are untrusted. Tenant, role and authorization claims must be verified server-side.
2. External provider responses are untrusted until schema, provenance and policy validation passes.
3. Cross-portfolio service calls require explicit authentication, tenant context, idempotency and audit evidence.
4. Database migrations and destructive operations require an authorized operator/release path.
5. Production secrets remain outside source control and are injected by the deployment environment.

## Failure boundaries

- Provider failure must return an explicit unavailable/degraded state; no fabricated estimate evidence.
- Dispatch/outbox operations must be retryable and idempotent.
- Payment/billing failure must not alter approved estimate evidence.
- QA rejection must preserve prior estimate versions and audit history.
- A failed migration, smoke test or readiness probe blocks certification and must not be converted into a warning.

## Release architecture

An exact commit is eligible for production only after repository verification, migration proof, tenant-isolation smoke tests, backup/restore proof, production-equivalent smoke testing, provider contract testing and rollback evidence. GitHub-hosted CI is optional infrastructure; exact-SHA local or self-hosted evidence is accepted when hosted runners cannot start.
