import test from 'node:test';
import assert from 'node:assert/strict';
import { compareEstimates } from './compare.js';
import type { Estimate, EstimateLine } from '../domain/types.js';

const line = (id: string, amountMinor: number): EstimateLine => ({
  id, category: 'body', component: id, operation: 'replace', quantity: 1,
  total: { amountMinor, currency: 'USD' }, humanApproved: true,
  provenance: [{ provider: 'test', retrievedAt: '2026-08-23T00:00:00Z', licenseClass: 'customer_provided' }],
});

const estimate = (id: string, lines: EstimateLine[]): Estimate => ({
  id, tenantId: 't', asset: { assetClass: 'passenger_vehicle' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  lines, subtotal: { amountMinor: lines.reduce((s,l)=>s+l.total.amountMinor,0), currency: 'USD' }, tax: { amountMinor: 0, currency: 'USD' },
  total: { amountMinor: lines.reduce((s,l)=>s+l.total.amountMinor,0), currency: 'USD' }, status: 'review', revision: 1,
  createdAt: '2026-08-23T00:00:00Z', updatedAt: '2026-08-23T00:00:00Z',
});

test('identifies added and removed scope', () => {
  const before = estimate('a', [line('door', 10000)]);
  const after = estimate('b', [line('hood', 15000)]);
  const result = compareEstimates(before, after);
  assert.equal(result.totalDeltaMinor, 5000);
  assert.equal(result.addedMinor, 15000);
  assert.equal(result.removedMinor, 10000);
});
