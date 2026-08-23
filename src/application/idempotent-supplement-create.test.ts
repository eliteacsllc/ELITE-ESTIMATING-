import test from 'node:test';
import assert from 'node:assert/strict';
import type { Estimate } from '../domain/types.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { InMemorySupplementRepository } from '../persistence/supplements.js';
import { InMemoryIdempotencyRepository } from '../api/idempotency.js';
import type { Principal } from '../security/rbac.js';
import { SupplementService } from './supplement-service.js';
import { IdempotentSupplementCreationService } from './idempotent-supplement-create.js';

const principal: Principal = { userId: 'reviewer-1', tenantId: 'tenant-a', roles: ['tenant_admin'] };

function approvedEstimate(id: string): Estimate {
  const now = new Date().toISOString();
  return {
    id,
    tenantId: principal.tenantId,
    asset: { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    status: 'approved',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

async function setup(): Promise<{
  service: IdempotentSupplementCreationService;
  estimates: InMemoryEstimateRepository;
  supplements: InMemorySupplementRepository;
}> {
  const estimates = new InMemoryEstimateRepository();
  const supplements = new InMemorySupplementRepository();
  const receipts = new InMemoryIdempotencyRepository();
  const supplementService = new SupplementService(estimates, supplements);
  return { service: new IdempotentSupplementCreationService(supplementService, supplements, receipts), estimates, supplements };
}

test('supplement creation replays the same deterministic supplement for the same key', async () => {
  const { service, estimates } = await setup();
  const estimate = approvedEstimate('11111111-1111-4111-8111-111111111111');
  await estimates.create(estimate);

  const first = await service.create(principal, 'supp-key-0001', estimate.id);
  const second = await service.create(principal, 'supp-key-0001', estimate.id);

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.supplement.id, first.supplement.id);
  assert.equal(second.supplement.estimateId, estimate.id);
});

test('supplement idempotency key cannot be reused for a different estimate', async () => {
  const { service, estimates } = await setup();
  const firstEstimate = approvedEstimate('11111111-1111-4111-8111-111111111111');
  const secondEstimate = approvedEstimate('22222222-2222-4222-8222-222222222222');
  await estimates.create(firstEstimate);
  await estimates.create(secondEstimate);

  await service.create(principal, 'supp-key-0002', firstEstimate.id);
  await assert.rejects(
    service.create(principal, 'supp-key-0002', secondEstimate.id),
    /idempotency_key_reused_with_different_request/,
  );
});
