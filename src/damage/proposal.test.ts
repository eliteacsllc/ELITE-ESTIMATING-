import assert from 'node:assert/strict';
import test from 'node:test';
import { canPromoteProposal, proposeEstimateLines } from './proposal.js';

const policy = { autoDraftMinimumConfidence: 0.85, safetyMinimumConfidence: 0.95 };
const provenance = [{ provider: 'vision-provider', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'licensed' as const }];

test('high confidence non-safety observation can become automated draft', () => {
  const [proposal] = proposeEstimateLines([{ id: 'obs-1', component: 'door', category: 'body', severity: 'minor', confidence: 0.93, provenance }], policy);
  assert.equal(proposal?.requiresHumanReview, false);
  assert.equal(canPromoteProposal(proposal!, false, false, policy), true);
});

test('safety observation always requires human and authoritative procedure', () => {
  const [proposal] = proposeEstimateLines([{ id: 'obs-2', component: 'radar', category: 'adas', severity: 'severe', confidence: 0.98, safetyCritical: true, provenance }], policy);
  assert.equal(proposal?.requiresHumanReview, true);
  assert.equal(proposal?.requiresAuthoritativeProcedure, true);
  assert.equal(canPromoteProposal(proposal!, false, true, policy), false);
  assert.equal(canPromoteProposal(proposal!, true, true, policy), true);
});

test('low confidence observation remains human reviewed', () => {
  const [proposal] = proposeEstimateLines([{ id: 'obs-3', component: 'quarter panel', category: 'body', severity: 'unknown', confidence: 0.4, provenance }], policy);
  assert.equal(proposal?.operation, 'inspect');
  assert.equal(proposal?.requiresHumanReview, true);
});
