import assert from 'node:assert/strict';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const requiredTables = [
  'schema_migrations',
  'estimates',
  'audit_events',
  'supplements',
  'integration_outbox',
  'estimate_evidence',
  'estimate_damage_graphs',
  'estimate_import_receipts',
  'mutation_idempotency_receipts',
  'rate_limit_buckets',
] as const;

const requiredIndexes = [
  'integration_outbox_pending_idx',
  'estimate_evidence_estimate_idx',
  'estimate_evidence_kind_idx',
  'estimate_damage_graphs_latest_idx',
  'estimate_import_receipts_local_idx',
  'mutation_idempotency_expiry_idx',
  'mutation_idempotency_resource_idx',
  'rate_limit_buckets_last_seen_idx',
] as const;

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  for (const table of requiredTables) {
    const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${table}`]);
    assert.equal(result.rows[0]?.present, true, `missing required table: ${table}`);
  }
  for (const index of requiredIndexes) {
    const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${index}`]);
    assert.equal(result.rows[0]?.present, true, `missing required index: ${index}`);
  }

  const migrationCount = await pool.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
  assert.ok(Number(migrationCount.rows[0]?.count ?? 0) >= 9, 'expected at least nine applied migrations');

  const orphanEvidence = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM estimate_evidence ev
     LEFT JOIN estimates e ON e.tenant_id=ev.tenant_id AND e.id=ev.estimate_id
     WHERE e.id IS NULL`,
  );
  assert.equal(Number(orphanEvidence.rows[0]?.count ?? 0), 0, 'orphan evidence rows detected');

  const orphanGraphs = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM estimate_damage_graphs g
     LEFT JOIN estimates e ON e.tenant_id=g.tenant_id AND e.id=g.estimate_id
     WHERE e.id IS NULL`,
  );
  assert.equal(Number(orphanGraphs.rows[0]?.count ?? 0), 0, 'orphan damage graphs detected');

  const orphanImports = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM estimate_import_receipts r
     LEFT JOIN estimates e ON e.tenant_id=r.tenant_id AND e.id=r.local_estimate_id
     WHERE e.id IS NULL`,
  );
  assert.equal(Number(orphanImports.rows[0]?.count ?? 0), 0, 'orphan import receipts detected');

  console.log('database schema integrity smoke passed');
} finally {
  await pool.end();
}
