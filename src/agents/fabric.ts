import type { FeatureId } from '../platform/features.js';
import { FEATURE_REGISTRY } from '../platform/features.js';
import { AGENTS, getAgent } from './registry.js';
import type { MeshCriticality } from './mesh.js';
import { runAgentJury, semanticChecksum, type DecisionVote } from './supervision.js';

export type SuperAgentId =
  | 'universal-estimate-supervisor'
  | 'damage-blueprint-supervisor'
  | 'safety-procedure-supervisor'
  | 'parts-pricing-supervisor'
  | 'valuation-total-loss-supervisor'
  | 'supplement-revision-supervisor'
  | 'property-scope-supervisor'
  | 'compliance-audit-supervisor'
  | 'evidence-interchange-supervisor';

export type SuperAgentDefinition = {
  id: SuperAgentId;
  purpose: string;
  specialists: string[];
  controls: ['orchestrator', 'security-governance', 'harmonization', 'quality-verification', 'recovery-fallback', 'performance-router'];
};

const CONTROLS: SuperAgentDefinition['controls'] = [
  'orchestrator',
  'security-governance',
  'harmonization',
  'quality-verification',
  'recovery-fallback',
  'performance-router'
];

export const SUPER_AGENTS: Readonly<Record<SuperAgentId, SuperAgentDefinition>> = {
  'universal-estimate-supervisor': {
    id: 'universal-estimate-supervisor',
    purpose: 'Coordinates the full estimate lifecycle across identity, damage, pricing, audit, compliance and revisions.',
    specialists: ['asset-identity', 'damage-analysis', 'pricing', 'estimate-audit', 'carrier-rules', 'compliance'],
    controls: CONTROLS
  },
  'damage-blueprint-supervisor': {
    id: 'damage-blueprint-supervisor',
    purpose: 'Builds evidence-backed damage scope and repair-plan candidates without inferring unsupported hidden damage.',
    specialists: ['damage-analysis', 'asset-identity', 'estimate-audit', 'oem-procedure'],
    controls: CONTROLS
  },
  'safety-procedure-supervisor': {
    id: 'safety-procedure-supervisor',
    purpose: 'Coordinates OEM, ADAS, structural, restraint and EV/HV safety evidence with hard human approval gates.',
    specialists: ['oem-procedure', 'adas-safety', 'compliance', 'estimate-audit'],
    controls: CONTROLS
  },
  'parts-pricing-supervisor': {
    id: 'parts-pricing-supervisor',
    purpose: 'Harmonizes labor, parts, materials and sourcing recommendations while preserving carrier and OEM constraints.',
    specialists: ['pricing', 'parts-sourcing', 'carrier-rules', 'estimate-audit', 'oem-procedure'],
    controls: CONTROLS
  },
  'valuation-total-loss-supervisor': {
    id: 'valuation-total-loss-supervisor',
    purpose: 'Coordinates valuation and economic decision evidence without inventing jurisdictional thresholds or final legal conclusions.',
    specialists: ['pricing', 'compliance', 'estimate-audit', 'fraud-anomaly'],
    controls: CONTROLS
  },
  'supplement-revision-supervisor': {
    id: 'supplement-revision-supervisor',
    purpose: 'Coordinates teardown discoveries, estimate deltas, supplements and revision integrity.',
    specialists: ['supplement', 'estimate-audit', 'pricing', 'oem-procedure', 'adas-safety'],
    controls: CONTROLS
  },
  'property-scope-supervisor': {
    id: 'property-scope-supervisor',
    purpose: 'Coordinates property scope, quantities, pricing, code/compliance and audit review.',
    specialists: ['property-scope', 'pricing', 'compliance', 'estimate-audit'],
    controls: CONTROLS
  },
  'compliance-audit-supervisor': {
    id: 'compliance-audit-supervisor',
    purpose: 'Cross-checks estimate quality, carrier policy, anomaly indicators, licensing, privacy and jurisdiction controls.',
    specialists: ['estimate-audit', 'carrier-rules', 'compliance', 'fraud-anomaly'],
    controls: CONTROLS
  },
  'evidence-interchange-supervisor': {
    id: 'evidence-interchange-supervisor',
    purpose: 'Protects provenance and canonical semantics across evidence, exports and external interchange boundaries.',
    specialists: ['interoperability', 'quality-verification', 'compliance', 'estimate-audit'],
    controls: CONTROLS
  }
};

export const FEATURE_SUPER_AGENT: Readonly<Record<FeatureId, SuperAgentId>> = {
  collision: 'universal-estimate-supervisor',
  property: 'property-scope-supervisor',
  commercial_truck: 'universal-estimate-supervisor',
  heavy_equipment: 'universal-estimate-supervisor',
  powersports: 'universal-estimate-supervisor',
  rv: 'universal-estimate-supervisor',
  marine: 'universal-estimate-supervisor',
  contents: 'property-scope-supervisor',
  specialty: 'universal-estimate-supervisor',
  super_appraiser: 'universal-estimate-supervisor',
  damage_ai: 'damage-blueprint-supervisor',
  vin_build: 'damage-blueprint-supervisor',
  oem_procedures: 'safety-procedure-supervisor',
  motor_raced: 'parts-pricing-supervisor',
  deg_intelligence: 'compliance-audit-supervisor',
  icar_blueprint: 'safety-procedure-supervisor',
  parts_optimizer: 'parts-pricing-supervisor',
  parts_exchange: 'parts-pricing-supervisor',
  labor_intelligence: 'parts-pricing-supervisor',
  adas_diagnostics: 'safety-procedure-supervisor',
  repair_replace: 'damage-blueprint-supervisor',
  repair_intelligence: 'damage-blueprint-supervisor',
  total_loss: 'valuation-total-loss-supervisor',
  market_comps: 'valuation-total-loss-supervisor',
  salvage: 'valuation-total-loss-supervisor',
  fraud_anomaly: 'compliance-audit-supervisor',
  estimate_audit: 'compliance-audit-supervisor',
  supplements: 'supplement-revision-supervisor',
  supplement_prediction: 'supplement-revision-supervisor',
  universal_interchange: 'evidence-interchange-supervisor',
  universal_dispatch: 'evidence-interchange-supervisor',
  carrier_compliance: 'compliance-audit-supervisor',
  screen_copilot: 'universal-estimate-supervisor',
  collaboration: 'evidence-interchange-supervisor',
  analytics: 'compliance-audit-supervisor',
  api_access: 'evidence-interchange-supervisor'
};

export type AgentCircuitState = 'closed' | 'half_open' | 'open';
export type AgentHealthSnapshot = {
  agentId: string;
  successRate: number;
  trustScore: number;
  p95LatencyMs: number;
  consecutiveFailures: number;
  circuit: AgentCircuitState;
  implementationFamily: string;
  sourceFamilies: string[];
};

export type PerformanceMode = 'throughput' | 'balanced' | 'assurance';
export type AgentRuntimeDisposition = 'eligible' | 'degraded' | 'isolated';

export type FabricAgentSlot = {
  agentId: string;
  implementationFamily: string;
  sourceFamilies: string[];
  score: number;
  disposition: AgentRuntimeDisposition;
  reasons: string[];
};

export type FabricExecutionTicket = {
  tenantId: string;
  estimateId: string;
  revision: number;
  feature: FeatureId;
  superAgent: SuperAgentId;
  allowedAgents: string[];
  criticality: MeshCriticality;
  expiresAt: string;
  checksum: string;
};

export type FabricExecutionPlan = {
  feature: FeatureId;
  superAgent: SuperAgentDefinition;
  criticality: MeshCriticality;
  performanceMode: PerformanceMode;
  primary: FabricAgentSlot;
  shadows: FabricAgentSlot[];
  isolated: FabricAgentSlot[];
  minimumIndependentImplementations: number;
  minimumSourceFamilies: number;
  hedgeAfterMs: number;
  hardDeadlineMs: number;
  controls: SuperAgentDefinition['controls'];
  ticket: FabricExecutionTicket;
  humanApprovalRequired: true;
  automaticFinalMutationAllowed: false;
};

export type FabricCandidate = {
  agentId: string;
  implementationFamily: string;
  outputKey: string;
  confidence: number;
  evidenceRefs: string[];
  sourceFamilies: string[];
  latencyMs: number;
  ticketChecksum: string;
  safetyVeto?: boolean;
  error?: string;
};

export type FabricDecision = {
  disposition: 'candidate' | 'human_review' | 'reject';
  selectedOutputKey: string | null;
  confidence: number;
  participatingAgents: string[];
  independentImplementations: number;
  sourceDiversity: number;
  evidenceRefs: string[];
  reasons: string[];
  quarantinedAgents: string[];
  humanApprovalRequired: true;
  automaticFinalMutationAllowed: false;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizedHealth(agentId: string, health: ReadonlyMap<string, AgentHealthSnapshot>): AgentHealthSnapshot {
  const observed = health.get(agentId);
  if (!observed) {
    return {
      agentId,
      successRate: 1,
      trustScore: 0.75,
      p95LatencyMs: 0,
      consecutiveFailures: 0,
      circuit: 'closed',
      implementationFamily: agentId,
      sourceFamilies: []
    };
  }
  return {
    ...observed,
    agentId,
    successRate: clamp01(observed.successRate),
    trustScore: clamp01(observed.trustScore),
    p95LatencyMs: Math.max(0, observed.p95LatencyMs),
    consecutiveFailures: Math.max(0, Math.trunc(observed.consecutiveFailures)),
    implementationFamily: observed.implementationFamily.trim() || agentId,
    sourceFamilies: [...new Set(observed.sourceFamilies.map((value) => value.trim()).filter(Boolean))]
  };
}

export function performanceModeFor(criticality: MeshCriticality, utilization: number): PerformanceMode {
  if (criticality === 'safety_critical') return 'assurance';
  const load = clamp01(utilization);
  if (criticality === 'important') return load >= 0.9 ? 'balanced' : 'assurance';
  return load >= 0.8 ? 'throughput' : 'balanced';
}

function timingFor(mode: PerformanceMode, criticality: MeshCriticality): { hedgeAfterMs: number; hardDeadlineMs: number } {
  if (criticality === 'safety_critical') return { hedgeAfterMs: 125, hardDeadlineMs: 4500 };
  if (mode === 'assurance') return { hedgeAfterMs: 200, hardDeadlineMs: 3500 };
  if (mode === 'balanced') return { hedgeAfterMs: 350, hardDeadlineMs: 2500 };
  return { hedgeAfterMs: 650, hardDeadlineMs: 1800 };
}

export function classifyAgentHealth(snapshot: AgentHealthSnapshot, deadlineMs: number): FabricAgentSlot {
  const reasons: string[] = [];
  if (snapshot.circuit === 'open') reasons.push('circuit_open');
  if (snapshot.consecutiveFailures >= 3) reasons.push('failure_streak');
  if (snapshot.trustScore < 0.35) reasons.push('trust_below_floor');
  const isolated = reasons.length > 0;
  if (!isolated && snapshot.circuit === 'half_open') reasons.push('circuit_half_open');
  if (!isolated && snapshot.successRate < 0.75) reasons.push('success_rate_degraded');
  if (!isolated && snapshot.trustScore < 0.6) reasons.push('trust_degraded');
  if (!isolated && snapshot.p95LatencyMs > deadlineMs) reasons.push('latency_budget_degraded');
  const latencyFit = snapshot.p95LatencyMs <= 0 ? 1 : clamp01(deadlineMs / snapshot.p95LatencyMs);
  const score = clamp01(snapshot.trustScore * 0.45 + snapshot.successRate * 0.35 + latencyFit * 0.2);
  return {
    agentId: snapshot.agentId,
    implementationFamily: snapshot.implementationFamily,
    sourceFamilies: snapshot.sourceFamilies,
    score,
    disposition: isolated ? 'isolated' : reasons.length ? 'degraded' : 'eligible',
    reasons
  };
}

function ticketBody(input: Omit<FabricExecutionTicket, 'checksum'>): Omit<FabricExecutionTicket, 'checksum'> {
  return {
    ...input,
    allowedAgents: [...new Set(input.allowedAgents)].sort()
  };
}

export function createFabricExecutionTicket(input: Omit<FabricExecutionTicket, 'checksum'>): FabricExecutionTicket {
  const tenantId = input.tenantId.trim();
  const estimateId = input.estimateId.trim();
  if (!tenantId || !estimateId) throw new Error('fabric_ticket_identity_required');
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error('fabric_ticket_revision_invalid');
  const expiry = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry)) throw new Error('fabric_ticket_expiry_invalid');
  const body = ticketBody({ ...input, tenantId, estimateId });
  return { ...body, checksum: semanticChecksum(body) };
}

export function assertFabricExecutionTicket(ticket: FabricExecutionTicket, expected: Omit<FabricExecutionTicket, 'checksum'>, nowMs = Date.now()): void {
  const expectedTicket = createFabricExecutionTicket(expected);
  if (expectedTicket.checksum !== ticket.checksum) throw new Error('fabric_ticket_scope_mismatch');
  if (Date.parse(ticket.expiresAt) <= nowMs) throw new Error('fabric_ticket_expired');
}

function allTeamAgents(definition: SuperAgentDefinition): string[] {
  return [...new Set([...definition.specialists, ...definition.controls])];
}

export function assertFullFabricCoverage(): void {
  const featureIds = Object.keys(FEATURE_REGISTRY).sort();
  const mappedFeatures = Object.keys(FEATURE_SUPER_AGENT).sort();
  if (featureIds.join('|') !== mappedFeatures.join('|')) throw new Error('fabric_feature_coverage_incomplete');
  const coveredAgents = new Set(Object.values(SUPER_AGENTS).flatMap((definition) => allTeamAgents(definition)));
  const missingAgents = AGENTS.map((agent) => agent.id).filter((id) => !coveredAgents.has(id));
  if (missingAgents.length) throw new Error(`fabric_agent_coverage_incomplete:${missingAgents.join(',')}`);
  for (const definition of Object.values(SUPER_AGENTS)) allTeamAgents(definition).forEach((id) => getAgent(id));
}

export function buildFabricExecutionPlan(input: {
  tenantId: string;
  estimateId: string;
  revision: number;
  feature: FeatureId;
  criticality: MeshCriticality;
  utilization: number;
  health?: ReadonlyMap<string, AgentHealthSnapshot>;
  nowMs?: number;
  ticketTtlMs?: number;
}): FabricExecutionPlan {
  assertFullFabricCoverage();
  const superAgent = SUPER_AGENTS[FEATURE_SUPER_AGENT[input.feature]];
  const performanceMode = performanceModeFor(input.criticality, input.utilization);
  const timing = timingFor(performanceMode, input.criticality);
  const health = input.health ?? new Map<string, AgentHealthSnapshot>();
  const specialistSlots = superAgent.specialists
    .map((agentId) => classifyAgentHealth(normalizedHealth(agentId, health), timing.hardDeadlineMs))
    .sort((a, b) => {
      const rank = (value: AgentRuntimeDisposition): number => value === 'eligible' ? 0 : value === 'degraded' ? 1 : 2;
      return rank(a.disposition) - rank(b.disposition) || b.score - a.score || a.agentId.localeCompare(b.agentId);
    });
  const available = specialistSlots.filter((slot) => slot.disposition !== 'isolated');
  if (!available.length) throw new Error(`fabric_no_eligible_specialists:${superAgent.id}`);
  const primary = available[0];
  if (!primary) throw new Error(`fabric_primary_missing:${superAgent.id}`);
  const desiredShadows = input.criticality === 'safety_critical' ? 3 : input.criticality === 'important' ? 2 : performanceMode === 'throughput' ? 1 : 2;
  const shadows: FabricAgentSlot[] = [];
  const implementations = new Set([primary.implementationFamily]);
  for (const slot of available.slice(1)) {
    if (shadows.length >= desiredShadows) break;
    if (!implementations.has(slot.implementationFamily)) {
      shadows.push(slot);
      implementations.add(slot.implementationFamily);
    }
  }
  for (const slot of available.slice(1)) {
    if (shadows.length >= desiredShadows) break;
    if (!shadows.includes(slot)) shadows.push(slot);
  }
  const minimumIndependentImplementations = input.criticality === 'safety_critical' ? 2 : input.criticality === 'important' ? 2 : 1;
  const minimumSourceFamilies = input.criticality === 'safety_critical' ? 2 : 1;
  if (input.criticality === 'safety_critical' && new Set([primary, ...shadows].map((slot) => slot.implementationFamily)).size < minimumIndependentImplementations) {
    throw new Error('fabric_safety_independence_unavailable');
  }
  const nowMs = input.nowMs ?? Date.now();
  const ttl = Math.max(timing.hardDeadlineMs * 2, input.ticketTtlMs ?? 15_000);
  const ticket = createFabricExecutionTicket({
    tenantId: input.tenantId,
    estimateId: input.estimateId,
    revision: input.revision,
    feature: input.feature,
    superAgent: superAgent.id,
    allowedAgents: allTeamAgents(superAgent),
    criticality: input.criticality,
    expiresAt: new Date(nowMs + ttl).toISOString()
  });
  return {
    feature: input.feature,
    superAgent,
    criticality: input.criticality,
    performanceMode,
    primary,
    shadows,
    isolated: specialistSlots.filter((slot) => slot.disposition === 'isolated'),
    minimumIndependentImplementations,
    minimumSourceFamilies,
    hedgeAfterMs: timing.hedgeAfterMs,
    hardDeadlineMs: timing.hardDeadlineMs,
    controls: superAgent.controls,
    ticket,
    humanApprovalRequired: true,
    automaticFinalMutationAllowed: false
  };
}

export function nextAgentCircuitState(current: AgentCircuitState, succeeded: boolean, consecutiveFailures: number): AgentCircuitState {
  if (succeeded) return current === 'open' ? 'half_open' : 'closed';
  if (current === 'half_open') return 'open';
  return consecutiveFailures + 1 >= 3 ? 'open' : current;
}

export function shouldHedgeFabricPlan(plan: FabricExecutionPlan, elapsedMs: number, primaryCompleted: boolean, primaryFailed: boolean): boolean {
  if (!plan.shadows.length) return false;
  if (primaryFailed) return true;
  if (primaryCompleted) return false;
  return elapsedMs >= plan.hedgeAfterMs;
}

export function harmonizeFabricCandidates(
  plan: FabricExecutionPlan,
  candidates: FabricCandidate[],
  health: ReadonlyMap<string, AgentHealthSnapshot> = new Map()
): FabricDecision {
  const reasons: string[] = [];
  const quarantinedAgents: string[] = [];
  const allowed = new Set(plan.ticket.allowedAgents);
  const deduped = new Map<string, FabricCandidate>();
  for (const candidate of candidates) {
    if (candidate.ticketChecksum !== plan.ticket.checksum || !allowed.has(candidate.agentId)) {
      quarantinedAgents.push(candidate.agentId);
      continue;
    }
    const runtime = normalizedHealth(candidate.agentId, health);
    const slot = classifyAgentHealth(runtime, plan.hardDeadlineMs);
    if (slot.disposition === 'isolated') {
      quarantinedAgents.push(candidate.agentId);
      continue;
    }
    const family = candidate.implementationFamily.trim() || runtime.implementationFamily || candidate.agentId;
    const existing = deduped.get(family);
    if (!existing || candidate.confidence > existing.confidence) deduped.set(family, { ...candidate, implementationFamily: family });
  }
  const independent = [...deduped.values()].filter((candidate) => !candidate.error && candidate.outputKey.trim());
  if (independent.length < plan.minimumIndependentImplementations) reasons.push('independent_implementation_quorum_not_met');
  const sourceFamilies = new Set(independent.flatMap((candidate) => candidate.sourceFamilies.map((value) => value.trim()).filter(Boolean)));
  if (sourceFamilies.size < plan.minimumSourceFamilies) reasons.push('source_diversity_not_met');
  if (independent.some((candidate) => candidate.latencyMs > plan.hardDeadlineMs)) reasons.push('hard_deadline_exceeded');
  const votes: DecisionVote[] = independent.map((candidate) => {
    const runtime = normalizedHealth(candidate.agentId, health);
    const vote: DecisionVote = {
      agentId: candidate.agentId,
      outputKey: candidate.outputKey,
      confidence: clamp01(candidate.confidence) * Math.max(0.25, runtime.trustScore),
      sourceFamilies: candidate.sourceFamilies
    };
    if (candidate.safetyVeto !== undefined) vote.safetyVeto = candidate.safetyVeto;
    return vote;
  });
  const jury = runAgentJury(votes, plan.criticality);
  reasons.push(...jury.reasons);
  const winner = jury.winner;
  const winningCandidates = independent.filter((candidate) => candidate.outputKey === winner);
  const confidence = winningCandidates.length
    ? winningCandidates.reduce((sum, candidate) => sum + clamp01(candidate.confidence), 0) / winningCandidates.length
    : 0;
  const evidenceRefs = [...new Set(winningCandidates.flatMap((candidate) => candidate.evidenceRefs.filter(Boolean)))];
  if (quarantinedAgents.length) reasons.push('candidate_quarantined');
  const uniqueReasons = [...new Set(reasons)];
  const reject = !winner || independent.length === 0;
  const humanReview = !reject && (uniqueReasons.length > 0 || jury.disposition !== 'accept_candidate');
  return {
    disposition: reject ? 'reject' : humanReview ? 'human_review' : 'candidate',
    selectedOutputKey: winner,
    confidence,
    participatingAgents: independent.map((candidate) => candidate.agentId),
    independentImplementations: new Set(independent.map((candidate) => candidate.implementationFamily)).size,
    sourceDiversity: sourceFamilies.size,
    evidenceRefs,
    reasons: uniqueReasons,
    quarantinedAgents: [...new Set(quarantinedAgents)],
    humanApprovalRequired: true,
    automaticFinalMutationAllowed: false
  };
}