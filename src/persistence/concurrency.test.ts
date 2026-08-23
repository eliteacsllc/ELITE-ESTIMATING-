import test from 'node:test';
import assert from 'node:assert/strict';
import type { Estimate } from '../domain/types.js';
import { InMemoryEstimateRepository } from './memory.js';

function estimate(): Estimate {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    status: 'draft',
    revision: 1,
    createdAt: '2026-08-23T15:00:00.000Z',
    updatedAt: '2026-08-23T15:00:00.000Z',
  };
}

test('estimate repository rejects a stale optimistic concurrency token', async () => {
  const repository = new InMemoryEstimateRepository();
  const original = await repository.create(estimate());
  const first = { ...original, status: 'review' as const, updatedAt: '2026-08-23T15:00:00.001Z' };
  await repository.save(first, original.updatedAt);

  const stale = { ...original, status: 'void' as const, updatedAt: '2026-08-23T15:00:00.002Z' };
  await assert.rejects(repository.save(stale, original.updatedAt), /estimate_concurrent_modification/);

  const stored = await repository.getById(original.tenantId, original.id);
  assert.equal(stored?.status, 'review');
  assert.equal(stored?.updatedAt, first.updatedAt);
});
