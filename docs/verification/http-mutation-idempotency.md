# HTTP Mutation Idempotency Verification

This branch exists only to rerun the full production gate against repaired current `main` after:

- wiring deterministic supplement creation idempotency into the HTTP API,
- returning replay status consistently,
- mapping concurrent estimate and evidence source conflicts to HTTP 409,
- adding a black-box HTTP mutation smoke,
- repairing strict typing in the smoke token signer, and
- retaining the backup/restore and transaction recovery gates.

The checkpoint is GREEN only when strict tests, dependency audit, migrations, atomic transaction smoke, schema integrity, backup/restore, live HTTP idempotency smoke, readiness, and the production Docker build all pass.
