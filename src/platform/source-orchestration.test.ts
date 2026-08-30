import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFreeFirstSourcePlan } from './source-orchestration.js';

test('road vehicle source plan adds public recall intelligence without a paid provider', () => {
  const plan = buildFreeFirstSourcePlan(
    { assetClass: 'passenger_vehicle', vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Accord', jurisdiction: 'US-DE' },
    { enabled: ['collision','vin_build'], automationLevel: 'assisted' },
  );
  assert.equal(plan.paidProviderArchitecturallyRequired, false);
  assert.ok(plan.automaticCapabilities.includes('safety_recalls'));
  assert.ok(plan.sourcingCapabilities.includes('asset_identity'));
  assert.ok(plan.sourcingCapabilities.includes('build_configuration'));
  assert.ok(plan.sourcingCapabilities.includes('safety_recalls'));
  assert.equal(plan.coverage.find(item => item.capability === 'asset_identity')?.status, 'free_covered');
  assert.equal(plan.coverage.find(item => item.capability === 'safety_recalls')?.status, 'free_covered');
  assert.deepEqual(plan.inputGaps, []);
  assert.ok(plan.catalogSources.some(item => item.sourceId === 'nhtsa-vpic' && item.usable));
});

test('property source plan automatically combines OpenFEMA and NWS catastrophe sources', () => {
  const plan = buildFreeFirstSourcePlan(
    { assetClass: 'residential_property', jurisdiction: 'US-DE' },
    { enabled: [], automationLevel: 'manual' },
  );
  const weather = plan.coverage.find(item => item.capability === 'weather_catastrophe');
  assert.deepEqual(plan.automaticCapabilities, ['weather_catastrophe']);
  assert.equal(weather?.status, 'free_covered');
  assert.deepEqual(weather?.providers.sort(), ['nws-alerts','openfema-disasters']);
});

test('source plan reports missing public-query inputs instead of claiming runtime readiness', () => {
  const vehicle = buildFreeFirstSourcePlan(
    { assetClass: 'passenger_vehicle' },
    { enabled: ['collision','vin_build'], automationLevel: 'manual' },
  );
  assert.ok(vehicle.inputGaps.some(gap => gap.capability === 'asset_identity' && gap.fields.includes('vin')));
  assert.ok(vehicle.inputGaps.some(gap => gap.capability === 'safety_recalls' && gap.fields.includes('year')));

  const property = buildFreeFirstSourcePlan(
    { assetClass: 'residential_property' },
    { enabled: [], automationLevel: 'manual' },
  );
  assert.ok(property.inputGaps.some(gap => gap.capability === 'weather_catastrophe' && gap.fields.includes('jurisdiction')));
});

test('safety-critical paid-data gaps resolve to authoritative evidence instead of forced subscription', () => {
  const plan = buildFreeFirstSourcePlan(
    { assetClass: 'passenger_vehicle', vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Accord', jurisdiction: 'US-DE' },
    { enabled: ['collision','oem_procedures','adas_diagnostics'], automationLevel: 'copilot' },
  );
  assert.ok(plan.authoritativeEvidenceCapabilities.includes('oem_procedures'));
  assert.ok(plan.authoritativeEvidenceCapabilities.includes('adas_requirements'));
  assert.ok(plan.customerEvidenceCapabilities.includes('diagnostics'));
  assert.equal(plan.paidProviderArchitecturallyRequired, false);
  assert.ok(plan.catalogSources.some(item => item.sourceId === 'oem1stop' && item.mode === 'linkout'));
  assert.ok(plan.catalogSources.some(item => item.sourceId === 'motor-truspeed-repair' && item.mode === 'provider_agreement_required'));
});

test('executed provider agreement activates licensed source for covered subregion', () => {
  const plan = buildFreeFirstSourcePlan(
    { assetClass: 'passenger_vehicle', vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Accord', jurisdiction: 'US-DE' },
    { enabled: ['collision','oem_procedures'], automationLevel: 'copilot' },
    [],
    new Set(['motor-truspeed-repair']),
  );
  assert.ok(plan.catalogSources.some(item => item.sourceId === 'motor-truspeed-repair' && item.mode === 'automatic' && item.usable));
});
