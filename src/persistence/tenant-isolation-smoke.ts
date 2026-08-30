import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresEstimateRepository } from './postgres.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString });
const repository = new PostgresEstimateRepository(connectionString);
const id = randomUUID();
const tenantA = `tenant-a-${randomUUID()}`;
const tenantB = `tenant-b-${randomUUID()}`;
const now = new Date().toISOString();

const payload = (tenantId: string, claimId: string) => ({
  tenantId,
  id,
  claimId,
  revision: 1,
  status: 'draft',
  asset: { assetClass: 'passenger_vehicle' },
  jurisdiction: 'US',
  currency: 'USD',
  lines: [],
  totals: { subtotal: { amountMinor: 0, currency: 'USD' }, total: { amountMinor: 0, currency: 'USD' } },
  createdAt: now,
  updatedAt: now,
});

try {
  for (const [tenantId, claimId] of [[tenantA, 'claim-a'], [tenantB, 'claim-b']] as const) {
    const value = payload(tenantId, claimId);
    await pool.query(
      `INSERT INTO estimates
       (tenant_id,id,claim_id,revision,status,asset_class,jurisdiction,currency,payload,created_at,updated_at)
       VALUES ($1,$2,$3,1,'draft','passenger_vehicle','US','USD',$4::jsonb,$5,$5)`,
      [tenantId, id, claimId, JSON.stringify(value), now],
    );
  }

  const a = await repository.getById(tenantA, id);
  const b = await repository.getById(tenantB, id);
  assert.equal(a?.tenantId, tenantA);
  assert.equal(a?.claimId, 'claim-a');
  assert.equal(b?.tenantId, tenantB);
  assert.equal(b?.claimId, 'claim-b');

  const missing = await repository.getById(`tenant-missing-${randomUUID()}`, id);
  assert.equal(missing, null);

  const recentA = await repository.listRecent(tenantA, 100);
  const recentB = await repository.listRecent(tenantB, 100);
  assert.ok(recentA.every(item => item.tenantId === tenantA));
  assert.ok(recentB.every(item => item.tenantId === tenantB));
  assert.ok(recentA.some(item => item.id === id));
  assert.ok(recentB.some(item => item.id === id));

  const claimLeak = await repository.listByClaim(tenantB, 'claim-a');
  assert.equal(claimLeak.some(item => item.id === id), false);

  console.log(JSON.stringify({ green: true, sameIdAcrossTenants: true, crossTenantReadBlocked: true }));
} finally {
  await pool.query('DELETE FROM estimates WHERE id = $1 AND tenant_id = ANY($2::text[])', [id, [tenantA, tenantB]]).catch(() => undefined);
  await repository.close().catch(() => undefined);
  await pool.end().catch(() => undefined);
}
