import test from 'node:test';
import assert from 'node:assert/strict';
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
