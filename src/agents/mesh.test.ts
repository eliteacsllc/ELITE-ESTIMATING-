import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertFullAgentMeshCoverage,
  buildAgentExecutionPlan,
  harmonizeAgentCandidates,
  meshAgentCoverage,
  shouldAllowAutomaticMutation
} from './mesh.js';

test('every registered agent is reachable by the mesh', () => {
  const coverage = meshAgentCoverage();
  assert.deepEqual(coverage.unrouted, []);
  assert.doesNotThrow(() => assertFullAgentMeshCoverage());
  assert.ok(coverage.routed.includes('fraud-anomaly'));
  assert.ok(coverage.routed.includes('carrier-rules'));
  assert.ok(coverage.routed.includes('security-governance'));
  assert.ok(coverage.routed.includes('performance-router'));
});

test('fraud and carrier capabilities route to their actual specialists', () => {
  assert.equal(buildAgentExecutionPlan('fraud', 'important').primary, 'fraud-anomaly');
  assert.equal(buildAgentExecutionPlan('carrier', 'important').primary, 'carrier-rules');
  assert.equal(buildAgentExecutionPlan('compliance', 'important').primary, 'compliance');
});

test('safety-critical mesh requires corroboration and evidence quorum', () => {
  const plan = buildAgentExecutionPlan('procedures', 'safety_critical');
  const outcome = harmonizeAgentCandidates(plan, [
    { agentId: 'oem-procedure', outputKey: 'require-calibration', confidence: 0.98, evidenceRefs: ['oem-1'], latencyMs: 900 },
    { agentId: 'adas-safety', outputKey: 'require-calibration', confidence: 0.96, evidenceRefs: ['icar-1'], latencyMs: 1000 }
  ]);
  assert.equal(outcome.disposition, 'accepted');
  assert.equal(outcome.selectedOutputKey, 'require-calibration');
  assert.equal(outcome.consensusRatio, 1);
  assert.deepEqual(outcome.evidenceRefs.sort(), ['icar-1', 'oem-1']);
  assert.equal(shouldAllowAutomaticMutation(outcome), false);
});

test('safety veto forces human review even when agents otherwise agree', () => {
  const plan = buildAgentExecutionPlan('damage', 'safety_critical');
  const outcome = harmonizeAgentCandidates(plan, [
    { agentId: 'damage-analysis', outputKey: 'repair', confidence: 0.9, evidenceRefs: ['photo-1'], latencyMs: 700 },
    { agentId: 'adas-safety', outputKey: 'repair', confidence: 0.88, evidenceRefs: ['oem-2'], latencyMs: 800, safetyVeto: true }
  ]);
  assert.equal(outcome.disposition, 'human_review');
  assert.deepEqual(outcome.safetyVetoes, ['adas-safety']);
});

test('conflicting important agents fail consensus and escalate', () => {
  const plan = buildAgentExecutionPlan('parts', 'important');
  const outcome = harmonizeAgentCandidates(plan, [
    { agentId: 'parts-sourcing', outputKey: 'oem', confidence: 0.9, evidenceRefs: ['part-1'], latencyMs: 700 },
    { agentId: 'pricing', outputKey: 'recycled', confidence: 0.89, evidenceRefs: ['price-1'], latencyMs: 650 },
    { agentId: 'oem-procedure', outputKey: 'oem', confidence: 0.6, evidenceRefs: ['oem-1'], latencyMs: 500 }
  ]);
  assert.equal(outcome.disposition, 'human_review');
  assert.ok(outcome.disagreements.includes('recycled'));
});

test('agent failure degrades an otherwise valid routine route instead of silently disappearing', () => {
  const plan = buildAgentExecutionPlan('audit', 'routine');
  const outcome = harmonizeAgentCandidates(plan, [
    { agentId: 'estimate-audit', outputKey: 'clear', confidence: 0.95, evidenceRefs: ['audit-1'], latencyMs: 400 },
    { agentId: 'quality-verification', outputKey: '', confidence: 0, evidenceRefs: [], latencyMs: 100, error: 'provider_timeout' }
  ]);
  assert.equal(outcome.disposition, 'degraded');
  assert.ok(outcome.degradedReasons.includes('agent_failure_detected'));
  assert.ok(outcome.fallbackOrder.includes('recovery-fallback'));
});

test('missing safety-critical quorum is rejected fail-closed', () => {
  const plan = buildAgentExecutionPlan('procedures', 'safety_critical');
  const outcome = harmonizeAgentCandidates(plan, [
    { agentId: 'oem-procedure', outputKey: 'require-calibration', confidence: 0.99, evidenceRefs: ['oem-1'], latencyMs: 500 }
  ]);
  assert.equal(outcome.disposition, 'rejected');
  assert.ok(outcome.degradedReasons.includes('insufficient_agent_quorum'));
  assert.ok(outcome.degradedReasons.includes('insufficient_evidence_quorum'));
});
