import test from 'node:test';
import assert from 'node:assert/strict';
import type { Estimate } from '../domain/types.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { InMemorySupplementRepository } from '../persistence/supplements.js';
import type { Principal } from '../security/rbac.js';
import type { Supplement } from '../workflows/supplement.js';
import { SupplementService } from './supplement-service.js';

const principal: Principal = { userId: 'reviewer-1', tenantId: 'tenant-a', roles: ['tenant_admin'] };

function approvedEstimate(): Estimate {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: principal.tenantId,
    asset: { assetClass: 'passenger_vehicle' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    status: 'approved',
    revision: 1,
    createdAt: '2026-08-23T15:00:00.000Z',
    updatedAt: '2026-08-23T15:00:00.000Z',
  };
}

function submittedSupplement(estimateId: string): Supplement {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    estimateId,
    baseRevision: 1,
    changes: [],
    status: 'submitted',
    createdAt: '2026-08-23T15:01:00.000Z',
  };
}

class TransactionalSupplements extends InMemorySupplementRepository {
  approveCalls = 0;
  saveCalls = 0;

  override async save(tenantId: string, supplement: Supplement): Promise<Supplement> {
    this.saveCalls += 1;
    return super.save(tenantId, supplement);
  }

  async approveAndApply(_tenantId: string, supplement: Supplement, estimate: Estimate, _expectedUpdatedAt: string): Promise<{ supplement: Supplement; estimate: Estimate }> {
    this.approveCalls += 1;
    return { supplement: structuredClone(supplement), estimate: structuredClone(estimate) };
  }
}

test('supplement approval uses transactional repository capability when available', async () => {
  const estimates = new InMemoryEstimateRepository();
  const supplements = new TransactionalSupplements();
  const estimate = approvedEstimate();
  const supplement = submittedSupplement(estimate.id);
  await estimates.create(estimate);
  await supplements.create(principal.tenantId, supplement);

  const service = new SupplementService(estimates, supplements);
  const result = await service.approve(principal, supplement.id);

  assert.equal(supplements.approveCalls, 1);
  assert.equal(supplements.saveCalls, 0);
  assert.equal(result.supplement.status, 'approved');
  assert.equal(result.estimate.revision, 2);
});

test('non-transactional fallback restores submitted supplement when estimate save fails', async () => {
  const baseEstimates = new InMemoryEstimateRepository();
  const supplements = new InMemorySupplementRepository();
  const estimate = approvedEstimate();
  const supplement = submittedSupplement(estimate.id);
  await baseEstimates.create(estimate);
  await supplements.create(principal.tenantId, supplement);

  const estimates = {
    create: (...args: Parameters<InMemoryEstimateRepository['create']>) => baseEstimates.create(...args),
    getById: (...args: Parameters<InMemoryEstimateRepository['getById']>) => baseEstimates.getById(...args),
    listByClaim: (...args: Parameters<InMemoryEstimateRepository['listByClaim']>) => baseEstimates.listByClaim(...args),
    listRecent: (...args: Parameters<InMemoryEstimateRepository['listRecent']>) => baseEstimates.listRecent(...args),
    async save(): Promise<Estimate> { throw new Error('estimate_concurrent_modification'); },
  };

  const service = new SupplementService(estimates, supplements);
  await assert.rejects(service.approve(principal, supplement.id), /estimate_concurrent_modification/);
  const restored = await supplements.getById(principal.tenantId, supplement.id);
  assert.equal(restored?.status, 'submitted');
});
