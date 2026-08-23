import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineVehicleSafetyRules, inferSafetyRequirements } from './safety.js';
import type { EstimateLine } from '../domain/types.js';

const line = (id: string, component: string, operation: EstimateLine['operation']): EstimateLine => ({
  id, category: 'body', component, operation, quantity: 1,
  total: { amountMinor: 0, currency: 'USD' }, humanApproved: false,
  provenance: [{ provider: 'test', retrievedAt: '2026-08-23T00:00:00Z', licenseClass: 'customer_provided' }],
});

test('bumper replacement raises OEM, scan and calibration requirements', () => {
  const requirements = inferSafetyRequirements(
    { assetClass: 'passenger_vehicle' },
    [line('1', 'front bumper cover', 'replace')],
    baselineVehicleSafetyRules,
  );
  assert.deepEqual(new Set(requirements.map((r) => r.kind)), new Set(['oem_procedure','post_scan','calibration']));
});

test('frame repair requires measurement and structural review', () => {
  const requirements = inferSafetyRequirements(
    { assetClass: 'heavy_equipment' },
    [line('2', 'main frame rail', 'repair')],
    baselineVehicleSafetyRules,
  );
  assert.ok(requirements.some((r) => r.kind === 'measurement'));
  assert.ok(requirements.some((r) => r.kind === 'structural_review'));
});
