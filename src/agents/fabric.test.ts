import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS } from './registry.js';
import { FEATURE_REGISTRY } from '../platform/features.js';
import {
  FEATURE_SUPER_AGENT,
  SUPER_AGENTS,
  assertFabricExecutionTicket,
  assertFullFabricCoverage,
  buildFabricExecutionPlan,
  classifyAgentHealth,
  createFabricExecutionTicket,
  harmonizeFabricCandidates,
  nextAgentCircuitState,
  performanceModeFor,
  shouldHedgeFabricPlan,
  type AgentHealthSnapshot,
  type FabricCandidate
} from './fabric.js';

const health = (agentId: string, overrides: Partial<AgentHealthSnapshot> = {}): AgentHealthSnapshot => ({
  agentId,
  successRate: 0.98,
  trustScore: 0.94,
  p95LatencyMs: 600,
  consecutiveFailures: 0,
  circuit: 'closed',
  implementationFamily: agentId,
  sourceFamilies: ['licensed-provider'],
  ...overrides
});

test('fabric covers every feature and every registered agent', () => {
  assert.doesNotThrow(() => assertFullFabricCoverage());
  assert.deepEqual(Object.keys(FEATURE_SUPER_AGENT).sort(), Object.keys(FEATURE_REGISTRY).sort());
  const covered = new Set(Object.values(SUPER_AGENTS).flatMap((team) => [...team.specialists, ...team.controls]));
  assert.deepEqual(AGENTS.map((agent) => agent.id).filter((id) => !covered.has(id)), []);
});

test('safety critical execution always selects assurance and independent redundancy', () => {
  const snapshots = new Map<string, AgentHealthSnapshot>([
    ['oem-procedure', health('oem-procedure', { implementationFamily: 'oem-engine', sourceFamilies: ['oem'] })],
    ['adas-safety', health('adas-safety', { implementationFamily: 'safety-engine', sourceFamilies: ['oem', 'icar'] })],
    ['compliance', health('compliance', { implementationFamily: 'policy-engine', sourceFamilies: ['jurisdiction'] })],
    ['estimate-audit', health('estimate-audit', { implementationFamily: 'audit-engine', sourceFamilies: ['estimate'] })]
  ]);
  const plan = buildFabricExecutionPlan({
    tenantId: 'tenant-a', estimateId: 'estimate-1', revision: 4, feature: 'adas_diagnostics',
    criticality: 'safety_critical', utilization: 1, health: snapshots, nowMs: 1_000
  });
  assert.equal(plan.performanceMode, 'assurance');
  assert.equal(plan.superAgent.id, 'safety-procedure-supervisor');
  assert.equal(plan.minimumIndependentImplementations, 2);
  assert.ok(plan.shadows.length >= 1);
  assert.equal(plan.humanApprovalRequired, true);
  assert.equal(plan.automaticFinalMutationAllowed, false);
  assert.equal(new Set([plan.primary, ...plan.shadows].map((slot) => slot.implementationFamily)).size >= 2, true);
});

test('performance routing never downgrades safety and isolates unhealthy agents', () => {
  assert.equal(performanceModeFor('safety_critical', 1), 'assurance');
  assert.equal(performanceModeFor('routine', 0.95), 'throughput');
  const isolated = classifyAgentHealth(health('pricing', { trustScore: 0.2, consecutiveFailures: 4 }), 2000);
  assert.equal(isolated.disposition, 'isolated');
  assert.ok(isolated.reasons.includes('failure_streak'));
  assert.ok(isolated.reasons.includes('trust_below_floor'));
  assert.equal(nextAgentCircuitState('closed', false, 2), 'open');
  assert.equal(nextAgentCircuitState('open', true, 3), 'half_open');
});

test('scoped tickets fail closed on revision, feature and expiry drift', () => {
  const body = {
    tenantId: 'tenant-a', estimateId: 'estimate-1', revision: 2, feature: 'estimate_audit' as const,
    superAgent: 'compliance-audit-supervisor' as const,
    allowedAgents: ['estimate-audit', 'security-governance'],
    criticality: 'important' as const,
    expiresAt: new Date(20_000).toISOString()
  };
  const ticket = createFabricExecutionTicket(body);
  assert.doesNotThrow(() => assertFabricExecutionTicket(ticket, body, 10_000));
  assert.throws(() => assertFabricExecutionTicket(ticket, { ...body, revision: 3 }, 10_000), /fabric_ticket_scope_mismatch/);
  assert.throws(() => assertFabricExecutionTicket(ticket, body, 20_000), /fabric_ticket_expired/);
});

test('hedging launches shadows on failure or budget threshold but not after success', () => {
  const plan = buildFabricExecutionPlan({
    tenantId: 'tenant-a', estimateId: 'estimate-2', revision: 1, feature: 'parts_optimizer',
    criticality: 'important', utilization: 0.4, nowMs: 1_000
  });
  assert.equal(shouldHedgeFabricPlan(plan, plan.hedgeAfterMs - 1, false, false), false);
  assert.equal(shouldHedgeFabricPlan(plan, plan.hedgeAfterMs, false, false), true);
  assert.equal(shouldHedgeFabricPlan(plan, 1, false, true), true);
  assert.equal(shouldHedgeFabricPlan(plan, plan.hardDeadlineMs, true, false), false);
});

test('harmonizer rejects correlated replicas as independent safety quorum', () => {
  const snapshots = new Map<string, AgentHealthSnapshot>([
    ['oem-procedure', health('oem-procedure', { implementationFamily: 'same-engine', sourceFamilies: ['oem'] })],
    ['adas-safety', health('adas-safety', { implementationFamily: 'same-engine', sourceFamilies: ['oem'] })],
    ['compliance', health('compliance', { implementationFamily: 'policy-engine', sourceFamilies: ['jurisdiction'] })],
    ['estimate-audit', health('estimate-audit', { implementationFamily: 'audit-engine', sourceFamilies: ['estimate'] })]
  ]);
  const plan = buildFabricExecutionPlan({
    tenantId: 'tenant-a', estimateId: 'estimate-3', revision: 1, feature: 'adas_diagnostics',
    criticality: 'safety_critical', utilization: 0.2, health: snapshots, nowMs: 1_000
  });
  const candidates: FabricCandidate[] = [
    { agentId: 'oem-procedure', implementationFamily: 'same-engine', outputKey: 'calibrate', confidence: 0.95, evidenceRefs: ['oem-1'], sourceFamilies: ['oem'], latencyMs: 500, ticketChecksum: plan.ticket.checksum },
    { agentId: 'adas-safety', implementationFamily: 'same-engine', outputKey: 'calibrate', confidence: 0.96, evidenceRefs: ['oem-2'], sourceFamilies: ['oem'], latencyMs: 450, ticketChecksum: plan.ticket.checksum }
  ];
  const decision = harmonizeFabricCandidates(plan, candidates, snapshots);
  assert.equal(decision.disposition, 'human_review');
  assert.equal(decision.independentImplementations, 1);
  assert.ok(decision.reasons.includes('independent_implementation_quorum_not_met'));
  assert.ok(decision.reasons.includes('source_diversity_not_met'));
  assert.equal(decision.automaticFinalMutationAllowed, false);
});

test('harmonizer accepts a well-supported candidate but still requires human approval', () => {
  const snapshots = new Map<string, AgentHealthSnapshot>([
    ['oem-procedure', health('oem-procedure', { implementationFamily: 'oem-engine', sourceFamilies: ['oem'] })],
    ['adas-safety', health('adas-safety', { implementationFamily: 'safety-engine', sourceFamilies: ['icar'] })],
    ['compliance', health('compliance', { implementationFamily: 'policy-engine', sourceFamilies: ['jurisdiction'] })],
    ['estimate-audit', health('estimate-audit', { implementationFamily: 'audit-engine', sourceFamilies: ['estimate'] })]
  ]);
  const plan = buildFabricExecutionPlan({
    tenantId: 'tenant-a', estimateId: 'estimate-4', revision: 1, feature: 'adas_diagnostics',
    criticality: 'safety_critical', utilization: 0.2, health: snapshots, nowMs: 1_000
  });
  const candidates: FabricCandidate[] = [
    { agentId: 'oem-procedure', implementationFamily: 'oem-engine', outputKey: 'calibrate', confidence: 0.96, evidenceRefs: ['oem-1'], sourceFamilies: ['oem'], latencyMs: 500, ticketChecksum: plan.ticket.checksum },
    { agentId: 'adas-safety', implementationFamily: 'safety-engine', outputKey: 'calibrate', confidence: 0.97, evidenceRefs: ['icar-1'], sourceFamilies: ['icar'], latencyMs: 450, ticketChecksum: plan.ticket.checksum },
    { agentId: 'compliance', implementationFamily: 'policy-engine', outputKey: 'calibrate', confidence: 0.91, evidenceRefs: ['jurisdiction-1'], sourceFamilies: ['jurisdiction'], latencyMs: 550, ticketChecksum: plan.ticket.checksum },
    { agentId: 'estimate-audit', implementationFamily: 'audit-engine', outputKey: 'calibrate', confidence: 0.9, evidenceRefs: ['estimate-1'], sourceFamilies: ['estimate'], latencyMs: 600, ticketChecksum: plan.ticket.checksum },
    { agentId: 'rogue-agent', implementationFamily: 'rogue', outputKey: 'skip', confidence: 1, evidenceRefs: [], sourceFamilies: [], latencyMs: 1, ticketChecksum: 'forged' }
  ];
  const decision = harmonizeFabricCandidates(plan, candidates, snapshots);
  assert.equal(decision.selectedOutputKey, 'calibrate');
  assert.equal(decision.disposition, 'human_review');
  assert.ok(decision.reasons.includes('candidate_quarantined'));
  assert.deepEqual(decision.quarantinedAgents, ['rogue-agent']);
  assert.equal(decision.sourceDiversity >= 2, true);
  assert.equal(decision.humanApprovalRequired, true);
  assert.equal(decision.automaticFinalMutationAllowed, false);
});
