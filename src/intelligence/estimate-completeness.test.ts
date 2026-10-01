import test from 'node:test';
import assert from 'node:assert/strict';
import type { Estimate, EstimateLine } from '../domain/types.js';
import { buildEstimateCompletenessReview } from './estimate-completeness.js';

function line(overrides: Partial<EstimateLine> = {}): EstimateLine {
  return {
    id: overrides.id ?? 'line-1',
    category: overrides.category ?? 'body',
    component: overrides.component ?? 'bumper',
    operation: overrides.operation ?? 'replace',
    quantity: overrides.quantity ?? 1,
    total: overrides.total ?? { amountMinor: 10000, currency: 'USD' },
    humanApproved: overrides.humanApproved ?? true,
    provenance: overrides.provenance ?? [{ provider: 'OEM', retrievedAt: '2026-10-01T00:00:00Z', licenseClass: 'licensed' }],
    ...overrides,
  };
}

function estimate(lines: EstimateLine[]): Estimate {
  return {
    id: 'est-1',
    tenantId: 'tenant-1',
    asset: { assetClass: 'passenger_vehicle', vin: '1TESTVIN' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'MD',
    lines,
    subtotal: { amountMinor: 10000, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 10000, currency: 'USD' },
    status: 'review',
    revision: 1,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

test('flags likely scan and calibration review without claiming an operation is definitely required', () => {
  const result = buildEstimateCompletenessReview(estimate([
    line({ component: 'front radar sensor', operation: 'replace', procedureRefs: ['oem-radar'], safetyCritical: true }),
  ]));
  assert.equal(result.status, 'needs_review');
  assert.ok(result.candidates.some(item => item.code === 'review:diagnostic_scan'));
  assert.ok(result.candidates.some(item => item.code === 'review:calibration'));
  assert.equal(result.requiresHumanReview, true);
});

test('blocks release-quality defects already detected by estimate audit', () => {
  const result = buildEstimateCompletenessReview(estimate([
    line({ component: 'frame rail', safetyCritical: true, procedureRefs: [], humanApproved: false, provenance: [] }),
  ]));
  assert.equal(result.status, 'blocked');
  assert.ok(result.summary.blockers >= 1);
  assert.ok(result.candidates.some(item => item.code === 'audit:safety_procedure_missing'));
});

test('returns ready for a clean estimate without heuristic triggers', () => {
  const result = buildEstimateCompletenessReview(estimate([
    line({ component: 'bumper cover', operation: 'remove_install' }),
  ]));
  assert.equal(result.status, 'ready');
  assert.equal(result.score, 100);
  assert.equal(result.candidates.length, 0);
});

test('suggests structural measurement review when structural work has no measure line', () => {
  const result = buildEstimateCompletenessReview(estimate([
    line({ component: 'left frame rail', operation: 'repair', procedureRefs: ['oem-rail'], safetyCritical: true }),
  ]));
  assert.ok(result.candidates.some(item => item.code === 'review:structural_measurement'));
});

test('does not duplicate scan review when a scan operation is already present', () => {
  const result = buildEstimateCompletenessReview(estimate([
    line({ id: 'radar', component: 'front radar sensor', operation: 'replace', procedureRefs: ['oem-radar'], safetyCritical: true }),
    line({ id: 'scan', component: 'diagnostic scan', operation: 'scan' }),
    line({ id: 'cal', component: 'front radar calibration', operation: 'calibrate' }),
  ]));
  assert.equal(result.candidates.some(item => item.code === 'review:diagnostic_scan'), false);
  assert.equal(result.candidates.some(item => item.code === 'review:calibration'), false);
});
