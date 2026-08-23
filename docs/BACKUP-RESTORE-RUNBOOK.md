# Elite Estimating Backup & Restore Runbook

## Purpose

Elite Estimating must be recoverable, not merely deployable. Production launch requires evidence that database backups are encrypted, restorable, monitored, and exercised on a recurring basis.

## Minimum production controls

1. Use provider-managed PostgreSQL backups plus point-in-time recovery when the selected production provider supports it.
2. Encrypt backups at rest and in transit. Backup credentials must remain separate from application source control.
3. Keep backup access least-privileged and audited.
4. Define business-owned Recovery Point Objective (RPO) and Recovery Time Objective (RTO) before production. Do not invent regulatory retention periods; retention must be selected per contract, jurisdiction, privacy requirements, and legal advice.
5. Alert when scheduled backups fail, become stale, or cannot be enumerated.
6. Exercise a restore into an isolated environment before launch and on a recurring schedule thereafter.
7. A restore is not considered valid until schema integrity, critical indexes, foreign-key relationships, and representative row counts are verified.
8. Object evidence in R2/S3-compatible storage requires its own versioning/retention/recovery policy; a PostgreSQL backup does not contain evidence binaries.
9. Never restore production data into an unsecured developer environment.

## Automated CI recovery proof

CI performs a disposable recovery drill on every verification run:

- migrate a fresh PostgreSQL database;
- execute transaction/integrity smoke tests;
- run schema-integrity checks;
- create a PostgreSQL custom-format dump;
- restore the dump into a new database;
- rerun schema and orphan checks against the restored database;
- compare critical estimate and supplement row counts between source and restore.

This proves the repository's current schema is dump/restore compatible. It does **not** replace production-provider backup configuration, encrypted retention, off-site durability, or a business-approved RPO/RTO.

## Incident restore sequence

1. Declare the incident and stop unsafe writes if integrity is uncertain.
2. Record the target recovery time and approved backup/PITR point.
3. Restore into a new database instance or isolated database first; do not overwrite the only surviving copy.
4. Run `npm run smoke:postgres:schema` against the restored database.
5. Validate tenant isolation, estimate counts, supplements, evidence metadata, damage graphs, import receipts, audit events, and integration outbox state.
6. Validate R2/object-storage evidence independently when evidence loss is in scope.
7. Point a staging instance of Elite Estimating at the restored database and verify `/ready`, representative read/write flows, approvals, supplements, exports, and webhook delivery.
8. Promote the restored database only after technical and business validation.
9. Record recovery duration, data-loss window, failed controls, and corrective actions.

## Launch gate

Production recovery is GREEN only when:

- production backup/PITR configuration is enabled and documented;
- backup encryption and access controls are verified;
- alerting exists for backup failure/staleness;
- at least one restore drill has passed against production-equivalent infrastructure;
- selected RPO/RTO are written and accepted by the business;
- database and object-storage recovery responsibilities are both documented.
