import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompleteness,
  canAutoApplyRecommendation,
  evaluateTotalLossSignal,
  recommendationRequiresHumanReview,
  type EstimateLineIntelligence,
} from './workspace.js';

test('completeness blocks release when a required check is blocked', () => {
  const result = calculateCompleteness([
    { id: 'damage', label: 'Damage documented', weight: 30, state: 'pass', evidenceCount: 4, explanation: '' },
    { id: 'oem', label: 'OEM reviewed', weight: 30, state: 'blocked', evidenceCount: 0, explanation: 'Missing procedure' },
    { id: 'pricing', label: 'Pricing verified', weight: 40, state: 'pass', evidenceCount: 2, explanation: '' },
  ]);
  assert.equal(result.releasable, false);
  assert.equal(result.blockers.length, 1);
});

test('total-loss signal includes expected supplement exposure', () => {
  const result = evaluateTotalLossSignal(14000, 2000, 20000, 0.75);
  assert.equal(result.projectedRatio, 0.8);
  assert.equal(result.requiresReview, true);
});

test('AI recommendations never silently auto-apply', () => {
  const recommendation: EstimateLineIntelligence = {
    lineId: '1',
    operation: 'Calibrate',
    component: 'Front radar',
    source: 'oem',
    sourceReference: 'OEM-123',
    confidence: 0.99,
    safetyCritical: true,
    evidenceRequired: true,
    rationale: 'Sensor removed',
  };
  assert.equal(canAutoApplyRecommendation(recommendation), false);
  assert.equal(recommendationRequiresHumanReview(recommendation), true);
});
