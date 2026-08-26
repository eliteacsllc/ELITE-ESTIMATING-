import { AGENTS } from './registry.js';

export type MeshCriticality = 'routine' | 'important' | 'safety_critical';
export type MeshDisposition = 'accepted' | 'human_review' | 'rejected' | 'degraded';

export type AgentCandidate = {
  agentId: string;
  outputKey: string;
  confidence: number;
  evidenceRefs: string[];
  latencyMs: number;
  safetyVeto?: boolean;
  error?: string;
};

export type AgentExecutionPlan = {
  primary: string;
  shadows: string[];
  verifier: string;
  harmonizer: string;
  security: string;
  recovery: string;
  performanceRouter: string;
  minResults: number;
  minEvidenceRefs: number;
  consensusThreshold: number;
  latencyBudgetMs: number;
};

export type AgentMeshOutcome = {
  disposition: MeshDisposition;
  selectedOutputKey: string | null;
  selectedAgentId: string | null;
  confidence: number;
  evidenceRefs: string[];
  consensusRatio: number;
  disagreements: string[];
  safetyVetoes: string[];
  degradedReasons: string[];
  fallbackOrder: string[];
};

const META_AGENTS = {
  harmonizer: 'harmonization',
  security: 'security-governance',
  recovery: 'recovery-fallback',
  performanceRouter: 'performance-router',
  verifier: 'quality-verification'
} as const;

const ROUTES: Record<string, string[]> = {
  damage: ['damage-analysis', 'estimate-audit', 'oem-procedure', 'adas-safety'],
  identity: ['asset-identity', 'quality-verification'],
  procedures: ['oem-procedure', 'adas-safety', 'compliance', 'quality-verification'],
  pricing: ['pricing', 'parts-sourcing', 'carrier-rules', 'estimate-audit'],
  parts: ['parts-sourcing', 'pricing', 'oem-procedure', 'estimate-audit'],
  audit: ['estimate-audit', 'quality-verification', 'compliance'],
  supplement: ['supplement', 'estimate-audit', 'pricing', 'quality-verification'],
  property: ['property-scope', 'pricing', 'compliance', 'quality-verification'],
  interoperability: ['interoperability', 'quality-verification', 'compliance'],
  default: ['orchestrator', 'estimate-audit', 'quality-verification']
};

function assertKnownAgent(agentId: string): void {
  if (!AGENTS.some((agent) => agent.id === agentId)) throw new Error(`Unknown agent in mesh plan: ${agentId}`);
}

export function buildAgentExecutionPlan(capability: string, criticality: MeshCriticality): AgentExecutionPlan {
  const route = ROUTES[capability] ?? ROUTES.default;
  const [primary, ...rest] = route;
  if (!primary) throw new Error(`No agent route for capability: ${capability}`);
  [...route, ...Object.values(META_AGENTS)].forEach(assertKnownAgent);

  const safetyCritical = criticality === 'safety_critical';
  const important = criticality === 'important';
  return {
    primary,
    shadows: safetyCritical ? rest : important ? rest.slice(0, 2) : rest.slice(0, 1),
    verifier: META_AGENTS.verifier,
    harmonizer: META_AGENTS.harmonizer,
    security: META_AGENTS.security,
    recovery: META_AGENTS.recovery,
    performanceRouter: META_AGENTS.performanceRouter,
    minResults: safetyCritical ? 2 : 1,
    minEvidenceRefs: safetyCritical ? 2 : 1,
    consensusThreshold: safetyCritical ? 0.8 : important ? 0.67 : 0.5,
    latencyBudgetMs: safetyCritical ? 4500 : important ? 3000 : 1800
  };
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizedEvidence(candidates: AgentCandidate[]): string[] {
  return [...new Set(candidates.flatMap((candidate) => candidate.evidenceRefs.filter(Boolean)))];
}

export function harmonizeAgentCandidates(
  plan: AgentExecutionPlan,
  candidates: AgentCandidate[]
): AgentMeshOutcome {
  if (!candidates.length) {
    return {
      disposition: 'rejected', selectedOutputKey: null, selectedAgentId: null, confidence: 0,
      evidenceRefs: [], consensusRatio: 0, disagreements: ['no_agent_results'], safetyVetoes: [],
      degradedReasons: ['mesh_empty'], fallbackOrder: [plan.recovery, ...plan.shadows]
    };
  }

  const safetyVetoes = candidates.filter((candidate) => candidate.safetyVeto).map((candidate) => candidate.agentId);
  const successful = candidates.filter((candidate) => !candidate.error && candidate.outputKey.trim());
  const evidenceRefs = normalizedEvidence(successful);
  const degradedReasons: string[] = [];

  if (successful.length < plan.minResults) degradedReasons.push('insufficient_agent_quorum');
  if (evidenceRefs.length < plan.minEvidenceRefs) degradedReasons.push('insufficient_evidence_quorum');
  if (successful.some((candidate) => candidate.latencyMs > plan.latencyBudgetMs)) degradedReasons.push('latency_budget_exceeded');
  if (candidates.some((candidate) => candidate.error)) degradedReasons.push('agent_failure_detected');

  const scores = new Map<string, { weighted: number; agents: string[]; confidenceTotal: number }>();
  for (const candidate of successful) {
    const confidence = clampConfidence(candidate.confidence);
    const latencyPenalty = candidate.latencyMs > plan.latencyBudgetMs ? 0.85 : 1;
    const evidenceBonus = candidate.evidenceRefs.length ? 1 : 0.7;
    const weight = confidence * latencyPenalty * evidenceBonus;
    const current = scores.get(candidate.outputKey) ?? { weighted: 0, agents: [], confidenceTotal: 0 };
    current.weighted += weight;
    current.agents.push(candidate.agentId);
    current.confidenceTotal += confidence;
    scores.set(candidate.outputKey, current);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1].weighted - a[1].weighted || a[0].localeCompare(b[0]));
  const winner = ranked[0];
  const selectedOutputKey = winner?.[0] ?? null;
  const selectedAgents = winner?.[1].agents ?? [];
  const selectedAgentId = selectedAgents.includes(plan.primary) ? plan.primary : selectedAgents[0] ?? null;
  const consensusRatio = successful.length ? selectedAgents.length / successful.length : 0;
  const disagreements = ranked.slice(1).map(([output]) => output);
  const confidence = winner && selectedAgents.length ? winner[1].confidenceTotal / selectedAgents.length : 0;

  if (safetyVetoes.length) {
    return {
      disposition: 'human_review', selectedOutputKey, selectedAgentId, confidence, evidenceRefs,
      consensusRatio, disagreements, safetyVetoes, degradedReasons, fallbackOrder: [plan.security, plan.verifier]
    };
  }

  if (!selectedOutputKey || successful.length < plan.minResults || evidenceRefs.length < plan.minEvidenceRefs) {
    return {
      disposition: 'rejected', selectedOutputKey, selectedAgentId, confidence, evidenceRefs,
      consensusRatio, disagreements, safetyVetoes, degradedReasons, fallbackOrder: [plan.recovery, ...plan.shadows]
    };
  }

  if (consensusRatio < plan.consensusThreshold) {
    return {
      disposition: 'human_review', selectedOutputKey, selectedAgentId, confidence, evidenceRefs,
      consensusRatio, disagreements, safetyVetoes, degradedReasons: [...degradedReasons, 'consensus_threshold_not_met'],
      fallbackOrder: [plan.harmonizer, plan.verifier]
    };
  }

  return {
    disposition: degradedReasons.length ? 'degraded' : 'accepted',
    selectedOutputKey, selectedAgentId, confidence, evidenceRefs, consensusRatio, disagreements, safetyVetoes,
    degradedReasons, fallbackOrder: degradedReasons.length ? [plan.performanceRouter, plan.recovery] : []
  };
}

export function shouldAllowAutomaticMutation(outcome: AgentMeshOutcome): boolean {
  return false;
}
