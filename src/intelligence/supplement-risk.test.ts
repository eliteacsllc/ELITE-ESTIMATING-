import assert from 'node:assert/strict';
import test from 'node:test';
import type { Estimate } from '../domain/types.js';
import { scoreSupplementRisk } from './supplement-risk.js';

const base: Estimate = {
  id: '11111111-1111-4111-8111-111111111111', tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle' },
  locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  lines: [{ id: 'line-1', category: 'body', component: 'door', operation: 'repair', quantity: 1, total: { amountMinor: 10000, currency: 'USD' }, humanApproved: true, provenance: [{ provider: 'expert', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'owned' }] }],
  repairPlan: { items: [], complete: true },
  subtotal: { amountMinor: 10000, currency: 'USD' }, tax: { amountMinor: 0, currency: 'USD' }, total: { amountMinor: 10000, currency: 'USD' },
  status: 'draft', revision: 1, createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z',
};

test('complete approved estimate scores low supplement risk', () => {
  assert.equal(scoreSupplementRisk(base).band, 'low');
});

test('missing safety procedure materially increases supplement risk', () => {
  const result = scoreSupplementRisk({ ...base, lines: [{ ...base.lines[0]!, safetyCritical: true, procedureRefs: [] }] });
  assert.ok(result.score >= 35);
  assert.ok(result.reasons.some(reason => reason.startsWith('safety_lines_missing_procedure')));
});

test('empty estimate is high risk', () => {
  assert.deepEqual(scoreSupplementRisk({ ...base, lines: [] }), { score: 100, band: 'high', reasons: ['no_estimate_lines'] });
});
