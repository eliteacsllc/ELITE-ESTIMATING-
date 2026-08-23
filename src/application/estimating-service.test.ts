import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from './estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import type { EstimateLine } from '../domain/types.js';

const estimator: Principal = { userId: 'u1', tenantId: 'tenant-a', roles: ['estimator'] };
const reviewer: Principal = { userId: 'u2', tenantId: 'tenant-a', roles: ['reviewer'] };

function approvedLine(): EstimateLine {
  return {
    id: 'line-1',
    category: 'body',
    component: 'front bumper',
    operation: 'replace',
    quantity: 1,
    partOrMaterial: { amountMinor: 50000, currency: 'USD' },
    laborHours: 2,
    laborRate: { amountMinor: 7500, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    humanApproved: true,
    provenance: [{ provider: 'customer', retrievedAt: new Date().toISOString(), licenseClass: 'customer_provided' }],
  };
}

test('tenant-scoped service creates and calculates an estimate', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  const estimate = await service.create(estimator, {
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle', vin: '1TEST' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const updated = await service.replaceLines(estimator, estimate.id, [approvedLine()]);
  assert.equal(updated.total.amountMinor, 65000);
  assert.equal(updated.status, 'review');
  const approved = await service.approve(reviewer, estimate.id);
  assert.equal(approved.status, 'approved');
});

test('cross-tenant creation is denied', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  await assert.rejects(() => service.create(estimator, {
    tenantId: 'tenant-b', asset: { assetClass: 'contents' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  }), /cross_tenant_access_denied/);
});

test('unapproved AI or human lines cannot be approved', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  const estimate = await service.create(estimator, {
    tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const line = { ...approvedLine(), humanApproved: false, aiSuggested: true, aiConfidence: 0.91 };
  await service.replaceLines(estimator, estimate.id, [line]);
  await assert.rejects(() => service.approve(reviewer, estimate.id), /human_approval_required/);
});
