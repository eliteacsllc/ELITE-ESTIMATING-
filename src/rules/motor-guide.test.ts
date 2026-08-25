import test from 'node:test';
import assert from 'node:assert/strict';
import type { EstimateLine } from '../domain/types.js';
import { auditMotorGuideLines } from './motor-guide.js';

function line(id: string, overrides: Partial<EstimateLine> = {}): EstimateLine {
  return {
    id,
    category: 'body',
    component: id,
    operation: 'replace',
    quantity: 1,
    laborHours: 1,
    total: { amountMinor: 10000, currency: 'USD' },
    humanApproved: true,
    provenance: [{ provider: 'MOTOR Information Systems', sourceId: `src-${id}`, retrievedAt: '2026-08-25T00:00:00.000Z', licenseClass: 'licensed' }],
    ...overrides,
  };
}

test('RACED source requires recycled assembly basis', () => {
  const findings = auditMotorGuideLines([line('quarter', {
    guide: { source: 'motor_raced', partBasis: 'new_oem', workTimeBasis: 'database' },
  })]);
  assert.ok(findings.some((finding) => finding.code === 'raced_requires_recycled_assembly' && finding.severity === 'blocker'));
});

test('new-part MOTOR guide cannot govern a recycled assembly', () => {
  const findings = auditMotorGuideLines([line('bed', {
    guide: { source: 'motor_gte', partBasis: 'recycled_assembly', workTimeBasis: 'database' },
  })]);
  assert.ok(findings.some((finding) => finding.code === 'recycled_requires_raced_or_other_recycled_source'));
});

test('included operations cannot be charged twice', () => {
  const findings = auditMotorGuideLines([
    line('assembly', { guide: { source: 'motor_raced', partBasis: 'recycled_assembly', workTimeBasis: 'database', includedLineIds: ['included-op'], assemblyComponents: ['outer panel'] } }),
    line('included-op'),
  ]);
  assert.ok(findings.some((finding) => finding.code === 'included_operation_duplicated'));
});

test('not-included operation is reviewable rather than auto-added', () => {
  const findings = auditMotorGuideLines([line('bumper', {
    guide: { source: 'motor_gte', partBasis: 'new_oem', workTimeBasis: 'database', notIncludedLineIds: ['clear-codes'] },
  })]);
  assert.ok(findings.some((finding) => finding.code === 'not_included_operation_review' && finding.severity === 'warning'));
  assert.equal(findings.some((finding) => finding.code === 'required_operation_missing'), false);
});

test('labor override requires original value and reason', () => {
  const findings = auditMotorGuideLines([line('door', {
    laborHours: 2,
    guide: { source: 'motor_gte', partBasis: 'new_oem', workTimeBasis: 'estimator_override', originalLaborHours: 1 },
  })]);
  assert.ok(findings.some((finding) => finding.code === 'override_reason_required'));
  assert.ok(findings.some((finding) => finding.code === 'labor_override_reason_required'));
});

test('footnote-based decision retains controlling footnote reference', () => {
  const findings = auditMotorGuideLines([line('hood', {
    guide: { source: 'motor_gte', partBasis: 'new_oem', workTimeBasis: 'footnote' },
  })]);
  assert.ok(findings.some((finding) => finding.code === 'footnote_reference_required'));
});

test('safety-critical guide line also requires authoritative procedure reference', () => {
  const findings = auditMotorGuideLines([line('radar', {
    safetyCritical: true,
    guide: { source: 'motor_gte', partBasis: 'new_oem', workTimeBasis: 'database' },
  })]);
  assert.ok(findings.some((finding) => finding.code === 'oem_procedure_required_for_safety_line'));
});

test('well-documented recycled assembly can pass without blockers', () => {
  const findings = auditMotorGuideLines([line('recycled-quarter', {
    procedureRefs: ['OEM:body-repair-manual:quarter-section'],
    guide: {
      source: 'motor_raced',
      revision: '11-25',
      partBasis: 'recycled_assembly',
      workTimeBasis: 'footnote',
      footnoteRefs: ['vehicle-specific-footnote-1'],
      assemblyComponents: ['quarter outer', 'inner structure', 'wheelhouse'],
    },
  })]);
  assert.equal(findings.filter((finding) => finding.severity === 'blocker').length, 0);
});
