import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEstimateRepository } from './memory.js';
import type { Estimate } from '../domain/types.js';

function estimate(id: string, tenantId: string, claimId: string, updatedAt: string): Estimate {
  return {
    id,
    tenantId,
    claimId,
    asset: { assetClass: 'passenger_vehicle', vin: `VIN-${id}` },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    status: 'draft',
    revision: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

test('recent estimates are tenant scoped and newest first', async () => {
  const repo = new InMemoryEstimateRepository();
  await repo.create(estimate('a', 't1', 'C-1', '2026-01-01T00:00:00.000Z'));
  await repo.create(estimate('b', 't1', 'C-2', '2026-01-03T00:00:00.000Z'));
  await repo.create(estimate('c', 't2', 'C-3', '2026-01-04T00:00:00.000Z'));
  const rows = await repo.listRecent('t1', 25);
  assert.deepEqual(rows.map(row => row.id), ['b', 'a']);
});

test('claim lookup cannot cross tenant boundaries', async () => {
  const repo = new InMemoryEstimateRepository();
  await repo.create(estimate('a', 't1', 'SHARED', '2026-01-01T00:00:00.000Z'));
  await repo.create(estimate('b', 't2', 'SHARED', '2026-01-02T00:00:00.000Z'));
  const rows = await repo.listByClaim('t1', 'SHARED');
  assert.deepEqual(rows.map(row => row.id), ['a']);
});
