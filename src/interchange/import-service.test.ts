import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import type { EliteEstimateEnvelope } from './elite-json.js';
import { InMemoryImportReceiptRepository } from './import-repository.js';
import { EstimateImportService } from './import-service.js';

const principal: Principal = { userId: 'u1', tenantId: 'tenant-local', roles: ['estimator'] };

function envelope(): EliteEstimateEnvelope {
  return {
    schema: 'elite-estimating/v1',
    exportedAt: new Date().toISOString(),
    estimate: {
      id: 'source-estimate-123',
      tenantId: 'foreign-tenant',
      claimId: 'CLM-42',
      asset: { assetClass: 'passenger_vehicle', vin: 'JTMAB3FV0PD000001' },
      locale: 'en-US',
      currency: 'USD',
      jurisdiction: 'US-FL',
      lines: [{
        id: 'line-1', category: 'body', component: 'Front bumper', operation: 'replace', quantity: 1,
        partOrMaterial: { amountMinor: 25000, currency: 'USD' }, total: { amountMinor: 25000, currency: 'USD' },
        humanApproved: true,
        provenance: [{ provider: 'source-system', retrievedAt: new Date().toISOString(), licenseClass: 'customer_provided' }],
      }],
      subtotal: { amountMinor: 25000, currency: 'USD' },
      tax: { amountMinor: 0, currency: 'USD' },
      total: { amountMinor: 25000, currency: 'USD' },
      status: 'approved', revision: 9,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  };
}

test('import normalizes tenant/status and is idempotent', async () => {
  const repo = new InMemoryEstimateRepository();
  const estimating = new EstimatingService(repo);
  const imports = new EstimateImportService(estimating, repo, new InMemoryImportReceiptRepository());

  const first = await imports.importElite(principal, envelope());
  assert.equal(first.idempotent, false);
  assert.equal(first.estimate.tenantId, principal.tenantId);
  assert.equal(first.estimate.status, 'review');
  assert.equal(first.estimate.revision, 1);
  assert.equal(first.estimate.lines[0]?.humanApproved, false);

  const second = await imports.importElite(principal, envelope());
  assert.equal(second.idempotent, true);
  assert.equal(second.estimate.id, first.estimate.id);
});

test('same source id maps independently per tenant', async () => {
  const repo = new InMemoryEstimateRepository();
  const estimating = new EstimatingService(repo);
  const receipts = new InMemoryImportReceiptRepository();
  const imports = new EstimateImportService(estimating, repo, receipts);
  const one = await imports.importElite(principal, envelope());
  const otherPrincipal: Principal = { userId: 'u2', tenantId: 'tenant-two', roles: ['estimator'] };
  const two = await imports.importElite(otherPrincipal, envelope());
  assert.notEqual(one.estimate.id, two.estimate.id);
  assert.equal(two.estimate.tenantId, 'tenant-two');
});
