import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAssetIdentity, validateCurrency, validateEstimateLineInput } from './validation.js';
import type { EstimateLine } from './types.js';

test('rejects unsupported asset identities and malformed currency', () => {
  assert.ok(validateAssetIdentity({ assetClass: 'passenger_vehicle', vin: 'INVALID-I' }).includes('invalid_vin_format'));
  assert.deepEqual(validateCurrency('usd'), ['currency_must_be_iso_4217_code']);
});

test('rejects cross-currency line money', () => {
  const line: EstimateLine = {
    id: 'l1', category: 'body', component: 'door', operation: 'replace', quantity: 1,
    partOrMaterial: { amountMinor: 10000, currency: 'EUR' },
    total: { amountMinor: 10000, currency: 'EUR' }, humanApproved: true,
    provenance: [{ provider: 'test', retrievedAt: '2026-08-23T00:00:00Z', licenseClass: 'customer_provided' }],
  };
  assert.ok(validateEstimateLineInput(line, 'USD').some((value) => value.startsWith('line_currency_mismatch')));
});

test('accepts supported specialty asset identities', () => {
  assert.deepEqual(validateAssetIdentity({ assetClass: 'industrial_machinery', serialNumber: 'CNC-4421', operatingHours: 12500 }), []);
  assert.deepEqual(validateAssetIdentity({ assetClass: 'marine', hin: 'ABC12345D626' }), []);
  assert.deepEqual(validateAssetIdentity({ assetClass: 'agricultural_equipment', serialNumber: 'AG-991' }), []);
});

test('rejects invalid specialty meter and HIN values', () => {
  assert.ok(validateAssetIdentity({ assetClass: 'industrial_machinery', operatingHours: -1 }).includes('invalid_operating_hours'));
  assert.ok(validateAssetIdentity({ assetClass: 'marine', hin: 'x' }).includes('invalid_hin_format'));
});
