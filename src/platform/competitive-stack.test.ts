import assert from 'node:assert/strict';
import test from 'node:test';
import { certifyCompetitiveStack, TOP_TIER_ESTIMATING_FEATURES } from './competitive-stack.js';

test('full passenger vehicle competitive stack certifies architecture green', () => {
  const result = certifyCompetitiveStack({ assetClass: 'passenger_vehicle', enabledFeatures: [...TOP_TIER_ESTIMATING_FEATURES], automationLevel: 'copilot' });
  assert.equal(result.green, true, result.blockers.join(','));
  assert.deepEqual(result.missingFeatures, []);
  assert.ok(result.externalProofStillRequired.includes('expert_reviewed_benchmark_certification'));
});

test('competitive certification never confuses architecture with external proof', () => {
  const result = certifyCompetitiveStack({ assetClass: 'passenger_vehicle', enabledFeatures: [...TOP_TIER_ESTIMATING_FEATURES], automationLevel: 'assisted' });
  assert.equal(result.green, true);
  assert.ok(result.externalProofStillRequired.length >= 5);
});

test('missing network-scale capability blocks competitive stack', () => {
  const enabled = TOP_TIER_ESTIMATING_FEATURES.filter(feature => feature !== 'universal_dispatch');
  const result = certifyCompetitiveStack({ assetClass: 'passenger_vehicle', enabledFeatures: [...enabled], automationLevel: 'copilot' });
  assert.equal(result.green, false);
  assert.ok(result.missingFeatures.includes('universal_dispatch'));
});
