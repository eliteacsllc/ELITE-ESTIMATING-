# Testing

## Required local / self-hosted gate

Use the same exact commit intended for release. The repository's `npm run verify` is the base code gate and must remain green.

Production certification also requires:

1. PostgreSQL migrations against a clean database.
2. Tenant-isolation smoke test.
3. Distributed rate-limit smoke test.
4. Atomic supplement transaction smoke test.
5. Schema-integrity smoke test.
6. Backup + restore with restored-row verification.
7. API readiness and health checks.
8. HTTP/idempotency and remote-edge smoke tests.
9. Production container build.
10. Cross-service contract tests for Claims, Damage IQ, Estimatics, QA, EVN/dispatch and financial events where enabled.

## Failure policy

A hosted-runner `startup_failure` is an infrastructure failure, not a source-code pass or fail. Re-run the exact SHA through an authorized self-hosted/local executor and retain the evidence bundle.

A real test failure blocks release until the defect is corrected and the exact replacement commit is re-certified.

## Evidence

Store release evidence with repository name, exact commit SHA, executor, timestamp, gate results, deployment target and rollback identifier. Never mark `production-readiness.json.certified` true solely because source files or workflow definitions exist.
