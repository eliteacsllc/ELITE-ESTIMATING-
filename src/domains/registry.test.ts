import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAIN_ADAPTERS, domainForAsset } from './registry.js';

test('every supported estimating asset class has at least one domain adapter', () => {
  const assetClasses = [
    'passenger_vehicle','commercial_vehicle','tractor_trailer','heavy_equipment','agricultural_equipment',
    'material_handling_equipment','industrial_machinery','motorcycle','atv_utv','rv','marine',
    'ambulance_emergency','crane_specialty','residential_property','commercial_property','contents','other',
  ] as const;
  for (const assetClass of assetClasses) assert.ok(DOMAIN_ADAPTERS.some(adapter => adapter.supports({ assetClass })));
});

test('property plan requires pricing and code capabilities', () => {
  const plan = domainForAsset({ assetClass: 'residential_property' }).plan({ assetClass: 'residential_property' });
  assert.equal(plan.domain, 'property');
  assert.ok(plan.providerCapabilities.includes('property_pricing'));
  assert.ok(plan.providerCapabilities.includes('codes_regulations'));
});

test('heavy equipment gets first-class inspection sections and risk flags', () => {
  const plan = domainForAsset({ assetClass: 'heavy_equipment' }).plan({ assetClass: 'heavy_equipment' });
  assert.equal(plan.domain, 'heavy_equipment');
  assert.ok(plan.profileSections.some(section => section.id === 'hydraulics'));
  assert.ok(plan.profileSections.some(section => section.id === 'attachments'));
  assert.ok(plan.riskFlags.includes('stored_energy'));
});

test('RV and marine retain domain-specific systems instead of generic specialty fallback', () => {
  const rv = domainForAsset({ assetClass: 'rv' }).plan({ assetClass: 'rv' });
  const marine = domainForAsset({ assetClass: 'marine' }).plan({ assetClass: 'marine' });
  assert.equal(rv.domain, 'rv');
  assert.equal(marine.domain, 'marine');
  assert.ok(rv.profileSections.some(section => section.id === 'lp-gas'));
  assert.ok(marine.profileSections.some(section => section.id === 'hull'));
});

test('industrial machinery has a dedicated estimating domain', () => {
  const plan = domainForAsset({ assetClass: 'industrial_machinery' }).plan({ assetClass: 'industrial_machinery' });
  assert.equal(plan.domain, 'machinery');
  assert.ok(plan.profileSections.some(section => section.id === 'commissioning'));
  assert.ok(plan.profileSections.some(section => section.id === 'rigging'));
  assert.ok(plan.riskFlags.includes('lockout_tagout'));
});

test('preferred domain must support asset class', () => {
  assert.throws(() => domainForAsset({ assetClass: 'marine' }, 'property'), /domain_not_applicable/);
});
