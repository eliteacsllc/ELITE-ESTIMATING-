import assert from 'node:assert/strict';
import test from 'node:test';
import type { Estimate } from '../domain/types.js';
import { auditEstimateIntelligence } from './estimate-audit.js';

const base: Estimate = {
  id: '11111111-1111-4111-8111-111111111111', tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle' },
  locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  lines: [{ id: 'line-1', category: 'body', component: 'door', operation: 'repair', quantity: 1, total: { amountMinor: 10000, currency: 'USD' }, humanApproved: true, provenance: [{ provider: 'expert', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'owned' }] }],
  subtotal: { amountMinor: 10000, currency: 'USD' }, tax: { amountMinor: 0, currency: 'USD' }, total: { amountMinor: 10000, currency: 'USD' },
  status: 'draft', revision: 1, createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z',
};

test('clean estimate remains green', () => {
  assert.equal(auditEstimateIntelligence(base).green, true);
});

test('safety critical line without procedure and approval blocks', () => {
  const result = auditEstimateIntelligence({ ...base, lines: [{ ...base.lines[0]!, safetyCritical: true, humanApproved: false, procedureRefs: [] }] });
  assert.equal(result.green, false);
  assert.ok(result.findings.some(finding => finding.code === 'safety_procedure_missing'));
  assert.ok(result.findings.some(finding => finding.code === 'safety_human_approval_missing'));
});

test('duplicate operation is surfaced for review', () => {
  const duplicate = { ...base.lines[0]!, id: 'line-2' };
  const result = auditEstimateIntelligence({ ...base, lines: [base.lines[0]!, duplicate] });
  assert.ok(result.findings.some(finding => finding.code === 'possible_duplicate_line'));
});

test('review ties arithmetic, approval and saved totals to a revision', () => {
  const broken = { ...base.lines[0]!, laborHours: 2, laborRate: { amountMinor: 3000, currency: 'USD' }, total: { amountMinor: 5000, currency: 'USD' }, humanApproved: false };
  const result = auditEstimateIntelligence({ ...base, revision: 7, lines: [broken] });
  assert.equal(result.green, false);
  assert.equal(result.revision, 7);
  assert.equal(result.estimateId, base.id);
  assert.ok(result.findings.some(f => f.code === 'line_arithmetic_mismatch'));
  assert.ok(result.findings.some(f => f.code === 'estimate_totals_mismatch'));
  assert.ok(result.findings.some(f => f.code === 'human_review_required'));
});

test('does not claim a below-market price without a licensed comparison', () => {
  const result = auditEstimateIntelligence({ ...base, lines: [{ ...base.lines[0]!, laborHours: 1, laborRate: { amountMinor: 1, currency: 'USD' }, total: { amountMinor: 1, currency: 'USD' } }], subtotal: { amountMinor: 1, currency: 'USD' }, total: { amountMinor: 1, currency: 'USD' } });
  assert.equal(result.green, true);
  assert.ok(!result.findings.some(f => f.code.includes('market')));
});
