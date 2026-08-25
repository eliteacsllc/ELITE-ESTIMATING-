import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_ADAPTERS, domainForAsset } from './registry.js';

test('every supported estimating asset class has at least one domain adapter', () => {
  const assetClasses = ['passenger_vehicle','commercial_vehicle','tractor_trailer','heavy_equipment','motorcycle','atv_utv','rv','marine','ambulance_emergency','crane_specialty','residential_property','commercial_property','contents','other'] as const;
  for (const assetClass of assetClasses) assert.ok(DOMAIN_ADAPTERS.some(adapter => adapter.supports({ assetClass })));
});

test('property plan requires pricing and code capabilities', () => {
  const plan = domainForAsset({ assetClass: 'residential_property' }).plan({ assetClass: 'residential_property' });
  assert.equal(plan.domain, 'property');
  assert.ok(plan.providerCapabilities.includes('property_pricing'));
  assert.ok(plan.providerCapabilities.includes('codes_regulations'));
});

test('preferred domain must support asset class', () => {
  assert.throws(() => domainForAsset({ assetClass: 'marine' }, 'property'), /domain_not_applicable/);
});
