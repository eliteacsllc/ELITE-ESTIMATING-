import test from 'node:test';
import assert from 'node:assert/strict';
import { damageIqCandidatesToDraftIQ } from './damage-iq-draftiq.js';

test('maps Damage IQ candidates into DraftIQ evidence-backed candidates', () => {
  const [candidate] = damageIqCandidatesToDraftIQ([{
    observationId: 'obs-1',
    component: 'left front door',
    suggestedOperation: 'replace',
    confidence: 0.93,
    evidenceIds: ['photo-1','photo-2'],
    requiresProcedureLookup: true,
    requiresHumanReview: false,
    reasons: [],
  }]);
  assert.equal(candidate?.operation, 'replace');
  assert.equal(candidate?.evidence[0]?.kind, 'photo');
  assert.equal(candidate?.evidence[0]?.source, 'elite-damage-iq');
  assert.ok(candidate?.rationale?.includes('procedure_lookup_required'));
});

test('carries safety review reason into DraftIQ safety flag', () => {
  const [candidate] = damageIqCandidatesToDraftIQ([{
    observationId: 'obs-2',
    component: 'front radar',
    suggestedOperation: 'inspect',
    confidence: 0.86,
    evidenceIds: ['photo-3'],
    requiresProcedureLookup: true,
    requiresHumanReview: true,
    reasons: ['safety_critical_component'],
  }]);
  assert.equal(candidate?.safetyCritical, true);
  assert.ok(candidate?.rationale?.includes('damage_iq_human_review_required'));
});
