import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentMeshMetrics } from './agent-mesh-metrics.js';

test('renders bounded mesh counters, latency and consensus without tenant or estimate labels', () => {
  const metrics = new AgentMeshMetrics();
  metrics.record({
    criticality: 'safety_critical', disposition: 'human_review', durationMs: 140,
    consensusRatio: 0.67, disagreementCount: 1, safetyVetoCount: 2, failedAgentCount: 0,
    shadowHedged: true, quarantined: true
  });
  metrics.record({
    criticality: 'important', disposition: 'accepted', durationMs: 420,
    consensusRatio: 1, disagreementCount: 0, safetyVetoCount: 0, failedAgentCount: 1,
    shadowHedged: false, quarantined: false
  });

  const output = metrics.renderPrometheus();
  assert.match(output, /elite_agent_mesh_executions_total\{criticality="safety_critical",disposition="human_review"\} 1/);
  assert.match(output, /elite_agent_mesh_safety_vetoes_total\{criticality="safety_critical"\} 2/);
  assert.match(output, /elite_agent_mesh_shadow_hedges_total\{criticality="safety_critical"\} 1/);
  assert.match(output, /elite_agent_mesh_quarantines_total\{criticality="safety_critical"\} 1/);
  assert.match(output, /elite_agent_mesh_agent_failures_total\{criticality="important"\} 1/);
  assert.match(output, /elite_agent_mesh_duration_seconds_bucket\{criticality="safety_critical",le="0\.25"\} 1/);
  assert.match(output, /elite_agent_mesh_consensus_ratio_count\{criticality="safety_critical"\} 1/);
  assert.doesNotMatch(output, /tenant/);
  assert.doesNotMatch(output, /estimateId/);
});

test('clamps invalid duration and consensus values', () => {
  const metrics = new AgentMeshMetrics();
  metrics.record({
    criticality: 'routine', disposition: 'degraded', durationMs: -10,
    consensusRatio: 5, disagreementCount: 0, safetyVetoCount: 0, failedAgentCount: 0,
    shadowHedged: false, quarantined: false
  });
  const output = metrics.renderPrometheus();
  assert.match(output, /elite_agent_mesh_duration_seconds_sum\{criticality="routine"\} 0/);
  assert.match(output, /elite_agent_mesh_consensus_ratio_sum\{criticality="routine"\} 1/);
});
