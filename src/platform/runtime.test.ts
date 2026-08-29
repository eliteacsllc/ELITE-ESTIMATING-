import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_FIRST_PROVIDER_DESCRIPTORS } from '../connectors/open-data.js';
import { buildPlatformPlan } from './runtime.js';

test('manual core does not require premium providers', () => {
  const plan = buildPlatformPlan({ assetClass: 'passenger_vehicle' }, { enabled: ['collision'], automationLevel: 'manual' });
  assert.deepEqual(plan.requiredProviderCapabilities, []);
  assert.deepEqual(plan.uncoveredCapabilities, []);
});

test('advanced collision modules expose exact uncovered provider capabilities', () => {
  const plan = buildPlatformPlan(
    { assetClass: 'passenger_vehicle' },
    { enabled: ['collision','vin_build','motor_raced','adas_diagnostics'], automationLevel: 'copilot' },
    [{ id: 'motor', name: 'Motor', capabilities: ['labor_times'], regions: ['US'], licenseRequired: true, tenantScopedCredentials: false }],
  );
  assert.ok(plan.requiredProviderCapabilities.includes('labor_times'));
  assert.ok(plan.requiredProviderCapabilities.includes('asset_identity'));
  assert.ok(plan.requiredProviderCapabilities.includes('adas_requirements'));
  assert.deepEqual(plan.providerCoverage.labor_times, ['motor']);
  assert.ok(plan.uncoveredCapabilities.includes('asset_identity'));
});

test('free public provider pack covers VIN identity and public safety without CCC', () => {
  const plan = buildPlatformPlan(
    { assetClass: 'passenger_vehicle', vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Accord' },
    { enabled: ['collision','public_vehicle_safety'], automationLevel: 'assisted' },
    FREE_FIRST_PROVIDER_DESCRIPTORS,
  );
  assert.ok(plan.enabledFeatures.includes('vin_build'));
  assert.ok(plan.requiredProviderCapabilities.includes('asset_identity'));
  assert.ok(plan.requiredProviderCapabilities.includes('build_configuration'));
  assert.ok(plan.requiredProviderCapabilities.includes('safety_recalls'));
  assert.deepEqual(plan.providerCoverage.asset_identity, ['nhtsa-vpic']);
  assert.deepEqual(plan.providerCoverage.build_configuration, ['nhtsa-vpic']);
  assert.deepEqual(plan.providerCoverage.safety_recalls, ['nhtsa-recalls']);
  assert.deepEqual(plan.uncoveredCapabilities, []);
});

test('public NHTSA safety feature does not falsely apply to property', () => {
  assert.throws(() => buildPlatformPlan(
    { assetClass: 'residential_property' },
    { enabled: ['property','public_vehicle_safety'], automationLevel: 'assisted' },
    FREE_FIRST_PROVIDER_DESCRIPTORS,
  ), /feature_not_applicable:public_vehicle_safety:residential_property/);
});
