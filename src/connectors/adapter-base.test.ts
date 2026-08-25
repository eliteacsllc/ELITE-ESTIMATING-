import test from 'node:test';
import assert from 'node:assert/strict';
import { GovernedProviderAdapter } from './adapter-base.js';

const adapter = new GovernedProviderAdapter(
  { id: 'parts-demo', name: 'Parts Demo', capabilities: ['parts'], regions: ['US'], licenseRequired: true, tenantScopedCredentials: true },
  {
    supports: () => true,
    async query<T>() { return [{ value: { part: 'x' } as T, provenance: { provider: 'parts-demo', retrievedAt: new Date().toISOString(), licenseClass: 'licensed' } }]; },
    async health() { return { ok: true, latencyMs: 1 }; },
  },
);

test('governed provider adapter enforces tenant and declared capability/region scope', async () => {
  assert.equal(adapter.supports({ tenantId: '', asset: { assetClass: 'passenger_vehicle' }, capability: 'parts', jurisdiction: 'US' }), false);
  assert.equal(adapter.supports({ tenantId: 't1', asset: { assetClass: 'passenger_vehicle' }, capability: 'parts', jurisdiction: 'CA' }), false);
  assert.equal(adapter.supports({ tenantId: 't1', asset: { assetClass: 'passenger_vehicle' }, capability: 'parts', jurisdiction: 'US' }), true);
  await assert.rejects(() => adapter.query({ tenantId: '', asset: { assetClass: 'passenger_vehicle' }, capability: 'parts', jurisdiction: 'US' }), /provider_tenant_required/);
});
