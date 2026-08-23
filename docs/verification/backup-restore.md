# Backup + Restore Verification

This branch exists only to run the expanded production gate against current `main` after adding:

- primary database schema/index/orphan integrity checks,
- PostgreSQL custom-format backup generation,
- restore into a clean database,
- restored schema integrity checks,
- source/restored critical row-count comparison, and
- the production backup/restore runbook.

The batch is GREEN only if strict tests, dependency audit, migrations, atomic transaction smoke, primary schema smoke, backup/restore drill, restored schema smoke, live readiness, and the production Docker build all pass.
