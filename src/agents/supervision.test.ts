import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adversarialTwinRequired,
  assertBlastRadius,
  assertIntentLock,
  blastRadiusFor,
  createImprovementProposal,
  createIntentLock,
  evaluateImprovementProposal,
  quarantineReasons,
  recoveryGraph,
  runAgentJury,
  semanticChecksum
} from './supervision.js';

test('intent lock and semantic checksum fail closed on revision or purpose drift', () => {
  const lock = createIntentLock({ tenantId: 'tenant-a', estimateId: 'estimate-1', revision: 3, intent: 'evaluate ADAS calibration requirement' });
  assert.equal(lock.checksum.length, 64);
  assert.equal(semanticChecksum({ b: 2, a: 1 }), semanticChecksum({ a: 1, b: 2 }));
  assert.doesNotThrow(() => assertIntentLock(lock, { tenantId: 'tenant-a', estimateId: 'estimate-1', revision: 3, intent: 'evaluate ADAS calibration requirement' }));
  assert.throws(() => assertIntentLock(lock, { tenantId: 'tenant-a', estimateId: 'estimate-1', revision: 4, intent: 'evaluate ADAS calibration requirement' }), /intent_lock_mismatch/);
});

test('safety-critical Agent Jury requires two independent keys and source diversity', () => {
  const jury = runAgentJury([
    { agentId: 'oem-procedure', outputKey: 'calibrate', confidence: 0.98, sourceFamilies: ['OEM'] },
    { agentId: 'adas-safety', outputKey: 'calibrate', confidence: 0.97, sourceFamilies: ['I-CAR'] },
    { agentId: 'quality-verification', outputKey: 'calibrate', confidence: 0.95, sourceFamilies: ['OEM'] }
  ], 'safety_critical');
  assert.equal(jury.disposition, 'accept_candidate');
  assert.equal(jury.winner, 'calibrate');
  assert.equal(jury.twoKeySatisfied, true);
  assert.equal(jury.sourceDiversity, 2);
  assert.equal(adversarialTwinRequired('safety_critical', jury), true);
});

test('safety veto and weak source diversity force review', () => {
  const jury = runAgentJury([
    { agentId: 'oem-procedure', outputKey: 'repair', confidence: 0.97, sourceFamilies: ['OEM'] },
    { agentId: 'adas-safety', outputKey: 'repair', confidence: 0.96, sourceFamilies: ['OEM'], safetyVeto: true }
  ], 'safety_critical');
  assert.equal(jury.disposition, 'human_review');
  assert.ok(jury.reasons.includes('safety_veto'));
  assert.ok(jury.reasons.includes('source_diversity_not_met'));
});

test('blast radius, quarantine and recovery graph isolate failures', () => {
  assert.deepEqual(blastRadiusFor('safety_critical'), { maxAffectedEntities: 1, requiresTwoKey: true, requiresAdversarialTwin: true, requiresHumanApproval: true });
  assert.throws(() => assertBlastRadius('safety_critical', 2), /blast_radius_exceeded/);
  const jury = runAgentJury([{ agentId: 'estimate-audit', outputKey: 'hold', confidence: 0.9, sourceFamilies: ['audit'] }], 'important');
  const reasons = quarantineReasons({ criticality: 'important', jury, stale: true, semanticDrift: true, affectedEntities: 11, failedAgentCount: 0 });
  assert.ok(reasons.includes('stale_state'));
  assert.ok(reasons.includes('semantic_drift'));
  assert.ok(reasons.includes('blast_radius_exceeded'));
  assert.ok(recoveryGraph('safety_critical').includes('security-governance'));
  assert.equal(recoveryGraph('safety_critical').at(-1), 'human-review');
});

test('learning expansion and correction proposals cannot self-promote', () => {
  for (const kind of ['learning','expansion','correction'] as const) {
    const proposal = createImprovementProposal({ id: `${kind}-1`, kind, observation: 'Repeated reviewed outcome gap', proposedChange: 'Propose a bounded rule or adapter update', evidenceRefs: ['case-1'], createdAt: '2026-08-26T20:00:00.000Z' });
    assert.equal(proposal.canSelfPromote, false);
    const automatedOnly = evaluateImprovementProposal(proposal, { regression: true, security: true, compatibility: true, provenance: true, isolation: true, rollback: true, domainKpi: true, humanApproval: false });
    assert.equal(automatedOnly.passedAutomatedGates, true);
    assert.equal(automatedOnly.proposal.status, 'evaluation_passed');
    assert.equal(automatedOnly.promotionAllowed, false);
    const approved = evaluateImprovementProposal(proposal, { regression: true, security: true, compatibility: true, provenance: true, isolation: true, rollback: true, domainKpi: true, humanApproval: true });
    assert.equal(approved.proposal.status, 'promotion_ready');
    assert.equal(approved.promotionAllowed, true);
  }
});

test('failed evaluation quarantines a proposed change', () => {
  const proposal = createImprovementProposal({ id: 'correction-2', kind: 'correction', observation: 'A stale rule produced a mismatch', proposedChange: 'Replace stale rule after review', evidenceRefs: ['audit-1'] });
  const evaluated = evaluateImprovementProposal(proposal, { regression: true, security: false, compatibility: true, provenance: true, isolation: true, rollback: true, domainKpi: true, humanApproval: true });
  assert.equal(evaluated.proposal.status, 'quarantined');
  assert.equal(evaluated.promotionAllowed, false);
  assert.deepEqual(evaluated.failedGates, ['security']);
});
