import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBenchmarkCertification, type BenchmarkCertificationManifest } from './certification.js';

const green: BenchmarkCertificationManifest = {
  version: 1,
  evidenceReference: 'benchmark-run-2026-001',
  market: 'US',
  assetClasses: ['passenger_vehicle'],
  totalCases: 100,
  expertReviewedCases: 100,
  meanLineRecall: 0.97,
  meanLinePrecision: 0.96,
  meanAbsoluteCostVariancePercent: 5,
  totalSafetyCriticalOmissions: 0,
  thresholds: {
    minimumCases: 100,
    minimumLineRecall: 0.95,
    minimumLinePrecision: 0.94,
    maximumMeanAbsoluteCostVariancePercent: 10,
    maximumSafetyCriticalOmissions: 0,
  },
  approvedByExpert: true,
  approvedAt: '2026-08-30T20:00:00Z',
};

test('fully reviewed benchmark certification can become green', () => {
  const result = evaluateBenchmarkCertification(green);
  assert.equal(result.green, true);
  assert.deepEqual(result.findings, []);
});

test('any safety-critical omission blocks zero-tolerance certification', () => {
  const result = evaluateBenchmarkCertification({ ...green, totalSafetyCriticalOmissions: 1 });
  assert.equal(result.green, false);
  assert.ok(result.findings.some(finding => finding.gate === 'benchmark_safety'));
});

test('partial expert review blocks certification', () => {
  const result = evaluateBenchmarkCertification({ ...green, expertReviewedCases: 99 });
  assert.equal(result.green, false);
  assert.ok(result.findings.some(finding => finding.gate === 'benchmark_review'));
});

test('insufficient benchmark volume blocks certification', () => {
  const result = evaluateBenchmarkCertification({ ...green, totalCases: 50, expertReviewedCases: 50 });
  assert.equal(result.green, false);
  assert.ok(result.findings.some(finding => finding.gate === 'benchmark_volume'));
});

test('expert approval is a hard gate', () => {
  const result = evaluateBenchmarkCertification({ ...green, approvedByExpert: false });
  assert.equal(result.green, false);
  assert.ok(result.findings.some(finding => finding.gate === 'benchmark_approval'));
});
