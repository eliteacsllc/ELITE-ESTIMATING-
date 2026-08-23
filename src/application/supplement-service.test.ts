import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from './estimating-service.js';
import { SupplementService } from './supplement-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { InMemorySupplementRepository } from '../persistence/supplements.js';
import type { Principal } from '../security/rbac.js';

const estimator: Principal = { userId: 'u1', tenantId: 't1', roles: ['estimator'] };
const reviewer: Principal = { userId: 'u2', tenantId: 't1', roles: ['reviewer'] };

test('creates, submits and applies approved supplement as new estimate revision', async () => {
  const estimateRepo = new InMemoryEstimateRepository();
  const estimating = new EstimatingService(estimateRepo);
  const supplements = new SupplementService(estimateRepo, new InMemorySupplementRepository());
  const base = await estimating.create(estimator, { tenantId: 't1', asset: { assetClass: 'contents' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US' });
  const approvedBase = await estimateRepo.save({ ...base, status: 'approved' });
  const supplement = await supplements.create(estimator, approvedBase.id);
  const changed = await supplements.addChange(estimator, supplement.id, {
    type: 'add', reason: 'Hidden damage discovered', line: {
      id: 's1', category: 'contents', component: 'replacement item', operation: 'replace', quantity: 1,
      partOrMaterial: { amountMinor: 20000, currency: 'USD' }, total: { amountMinor: 20000, currency: 'USD' }, humanApproved: true,
      provenance: [{ provider: 'user', retrievedAt: '2026-08-23T00:00:00Z', licenseClass: 'customer_provided' }],
    },
  });
  assert.equal(changed.changes.length, 1);
  const submitted = await supplements.submit(estimator, supplement.id);
  assert.equal(submitted.status, 'submitted');
  const applied = await supplements.approve(reviewer, supplement.id);
  assert.equal(applied.supplement.status, 'approved');
  assert.equal(applied.estimate.revision, 2);
  assert.equal(applied.estimate.total.amountMinor, 20000);
});
