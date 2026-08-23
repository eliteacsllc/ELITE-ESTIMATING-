import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryIdempotencyRepository, hashIdempotencyRequest } from '../api/idempotency.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import { EstimatingService } from './estimating-service.js';
import { IdempotentEstimateCreationService } from './idempotent-estimate-create.js';

const principal: Principal = { userId: 'u1', tenantId: 't1', roles: ['estimator'] };
const input = {
  claimId: 'CLM-100',
  asset: { assetClass: 'passenger_vehicle' as const, vin: 'JTMAB3FV0PD000001' },
  locale: 'en-US',
  currency: 'USD',
  jurisdiction: 'US-FL',
};

test('canonical request hashing ignores object key order', () => {
  assert.equal(hashIdempotencyRequest({ b: 2, a: 1 }), hashIdempotencyRequest({ a: 1, b: 2 }));
});

test('same idempotency key and request returns the same estimate', async () => {
  const estimates = new InMemoryEstimateRepository();
  const service = new IdempotentEstimateCreationService(new EstimatingService(estimates), estimates, new InMemoryIdempotencyRepository());
  const first = await service.create(principal, 'estimate-create-001', input);
  const second = await service.create(principal, 'estimate-create-001', input);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.estimate.id, first.estimate.id);
});

test('same live idempotency key with a different request is rejected', async () => {
  const estimates = new InMemoryEstimateRepository();
  const service = new IdempotentEstimateCreationService(new EstimatingService(estimates), estimates, new InMemoryIdempotencyRepository());
  await service.create(principal, 'estimate-create-002', input);
  await assert.rejects(
    () => service.create(principal, 'estimate-create-002', { ...input, claimId: 'CLM-DIFFERENT' }),
    /idempotency_key_reused_with_different_request/,
  );
});

test('idempotency is tenant scoped', async () => {
  const estimates = new InMemoryEstimateRepository();
  const receipts = new InMemoryIdempotencyRepository();
  const service = new IdempotentEstimateCreationService(new EstimatingService(estimates), estimates, receipts);
  const first = await service.create(principal, 'estimate-create-003', input);
  const other: Principal = { userId: 'u2', tenantId: 't2', roles: ['estimator'] };
  const second = await service.create(other, 'estimate-create-003', input);
  assert.notEqual(first.estimate.id, second.estimate.id);
});
