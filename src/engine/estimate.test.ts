import test from 'node:test';
import assert from 'node:assert/strict';
import { auditEstimateLines, lineTotal } from './estimate.js';
import type { EstimateLine } from '../domain/types.js';

test('calculates labor plus parts in minor units', () => {
  const total = lineTotal({
    id: 'l1',
    category: 'body',
    component: 'front bumper',
    operation: 'replace',
    quantity: 1,
    laborHours: 2,
    laborRate: { amountMinor: 7500, currency: 'USD' },
    partOrMaterial: { amountMinor: 50000, currency: 'USD' },
    humanApproved: false,
    provenance: [{ provider: 'test', retrievedAt: new Date(0).toISOString(), licenseClass: 'owned' }]
  });
  assert.deepEqual(total, { amountMinor: 65000, currency: 'USD' });
});

test('requires source-backed procedures for safety-critical lines', () => {
  const line: EstimateLine = {
    id: 'adas-1',
    category: 'adas',
    component: 'forward camera',
    operation: 'calibrate',
    quantity: 1,
    total: { amountMinor: 25000, currency: 'USD' },
    safetyCritical: true,
    humanApproved: false,
    provenance: [{ provider: 'test', retrievedAt: new Date(0).toISOString(), licenseClass: 'licensed' }]
  };
  assert.equal(auditEstimateLines([line]).length, 1);
});
