# Atomic Supplement Approval Verification

This branch exists only to verify current `main` after adding:

- transactional PostgreSQL supplement approval,
- optimistic estimate token enforcement inside the transaction,
- rollback-on-failure behavior,
- fallback rollback for local/non-transactional adapters,
- unit coverage for transaction selection and fallback recovery, and
- a real post-migration PostgreSQL transaction smoke in CI.

The expanded CI gate must pass strict tests, dependency audit, migrations, the transaction smoke, live readiness, and the production Docker build.
