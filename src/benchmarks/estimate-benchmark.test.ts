import assert from 'node:assert/strict';
import test from 'node:test';
import type { EstimateLine } from '../domain/types.js';
import { scoreEstimateAgainstExpert, scoreBenchmarkSuite, type BenchmarkCase, type BenchmarkThresholds } from './estimate-benchmark.js';

const thresholds: BenchmarkThresholds = {
  minimumLineRecall: 0.95,
  minimumLinePrecision: 0.95,
  maximumAbsoluteCostVariancePercent: 5,
  maximumSafetyCriticalOmissions: 0,
};

function line(id: string, component: string, total: number, safetyCritical = false): EstimateLine {
  return {
    id,
    category: 'body',
    component,
    operation: 'replace',
    quantity: 1,
    total: { amountMinor: total, currency: 'USD' },
    humanApproved: true,
    safetyCritical,
    provenance: [{ provider: 'expert', retrievedAt: new Date().toISOString(), licenseClass: 'owned', confidence: 1 }],
  };
}

const benchmark: BenchmarkCase = {
  id: 'case-1',
  assetClass: 'passenger_vehicle',
  jurisdiction: 'US',
  expertReviewed: true,
  referenceLines: [line('bumper', 'Front bumper', 10000), line('radar', 'Front radar sensor', 5000, true)],
};

test('expert-equivalent estimate passes benchmark', () => {
  const result = scoreEstimateAgainstExpert(benchmark, benchmark.referenceLines, thresholds);
  assert.equal(result.green, true);
  assert.equal(result.safetyCriticalOmissions.length, 0);
  assert.equal(result.lineRecall, 1);
  assert.equal(result.linePrecision, 1);
});

test('missing safety critical line is a blocker', () => {
  const result = scoreEstimateAgainstExpert(benchmark, [benchmark.referenceLines[0]!], thresholds);
  assert.equal(result.green, false);
  assert.ok(result.blockers.includes('safety_critical_omission'));
  assert.deepEqual(result.safetyCriticalOmissions, ['radar']);
});

test('unreviewed benchmark labels cannot certify a model', () => {
  assert.throws(() => scoreEstimateAgainstExpert({ ...benchmark, expertReviewed: false }, benchmark.referenceLines, thresholds), /benchmark_not_expert_reviewed/);
});

test('suite aggregates quality and blocks any failing case', () => {
  const second = { ...benchmark, id: 'case-2' };
  const result = scoreBenchmarkSuite([benchmark, second], new Map([
    ['case-1', benchmark.referenceLines],
    ['case-2', [benchmark.referenceLines[0]!]],
  ]), thresholds);
  assert.equal(result.green, false);
  assert.equal(result.totalSafetyCriticalOmissions, 1);
});
