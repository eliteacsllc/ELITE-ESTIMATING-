import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeEstimateProposal,
  type EstimateNormalizationInput,
} from './estimate-normalization.js';

function input(): EstimateNormalizationInput {
  return {
    tenantId: 'tenant-1',
    estimateId: 'estimate-1',
    currency: 'USD',
    lines: [{
      sourceLineId: 'line-1',
      category: 'body',
      component: 'left front door',
      operation: 'repair',
      quantity: 1,
      laborHours: 2.5,
      laborRate: { amountMinor: 8000, currency: 'USD' },
      procedureRefs: ['OEM-123', 'OEM-123'],
      safetyCritical: false,
      confidence: 0.91,
      provenance: [{
        provider: ' customer-feed ',
        sourceId: 'row-7',
        retrievedAt: '2026-09-10T12:00:00.000Z',
        licenseClass: 'customer_provided',
        confidence: 0.95,
      }],
    }],
  };
}

test('normalizes a provider-neutral line as an unapproved draft', () => {
  const result = normalizeEstimateProposal(input());

  assert.equal(result.readyForHumanReview, true);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.lines[0]?.humanApproved, false);
  assert.equal(result.lines[0]?.total.amountMinor, 20_000);
  assert.deepEqual(result.lines[0]?.procedureRefs, ['OEM-123']);
  assert.equal(result.lines[0]?.provenance[0]?.provider, 'customer-feed');
});

test('blocks cross-currency input before calculating a line', () => {
  const value = input();
  value.lines[0]!.laborRate = { amountMinor: 8_000, currency: 'CAD' };

  const result = normalizeEstimateProposal(value);

  assert.equal(result.readyForHumanReview, false);
  assert.equal(result.lines.length, 0);
  assert.ok(result.issues.some((issue) => issue.code === 'currency_mismatch'));
});

test('requires source-backed procedures for safety-critical work', () => {
  const value = input();
  value.lines[0]!.safetyCritical = true;
  value.lines[0]!.procedureRefs = [];

  const result = normalizeEstimateProposal(value);

  assert.equal(result.readyForHumanReview, false);
  assert.ok(result.issues.some((issue) => issue.code === 'safety_procedure_required'));
  assert.equal(result.lines[0]?.humanApproved, false);
});

test('flags uncertainty and duplicate provenance for human review', () => {
  const value = input();
  value.lines[0]!.confidence = 0.5;
  value.lines[0]!.provenance.push({ ...value.lines[0]!.provenance[0]! });

  const result = normalizeEstimateProposal(value);

  assert.equal(result.readyForHumanReview, true);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['low_confidence', 'duplicate_provenance'],
  );
});

test('rejects unsupported operations and duplicate source line ids', () => {
  const value = input();
  value.lines.push({ ...value.lines[0]! });
  value.lines[0]!.operation = 'invented-operation';

  const result = normalizeEstimateProposal(value);

  assert.equal(result.readyForHumanReview, false);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['operation_unsupported', 'duplicate_source_line_id'],
  );
});
