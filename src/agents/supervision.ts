import { createHash } from 'node:crypto';
import type { MeshCriticality } from './mesh.js';

export type DecisionVote = {
  agentId: string;
  outputKey: string;
  confidence: number;
  sourceFamilies: string[];
  safetyVeto?: boolean;
};

export type JuryDecision = {
  disposition: 'accept_candidate' | 'human_review' | 'reject';
  winner: string | null;
  agreement: number;
  sourceDiversity: number;
  twoKeySatisfied: boolean;
  vetoes: string[];
  reasons: string[];
};

export type IntentLock = {
  tenantId: string;
  estimateId: string;
  revision: number;
  intent: string;
  checksum: string;
};

export type BlastRadiusPolicy = {
  maxAffectedEntities: number;
  requiresTwoKey: boolean;
  requiresAdversarialTwin: boolean;
  requiresHumanApproval: true;
};

export type ImprovementKind = 'learning' | 'expansion' | 'correction';
export type ImprovementProposal = {
  id: string;
  kind: ImprovementKind;
  observation: string;
  proposedChange: string;
  evidenceRefs: string[];
  createdAt: string;
  status: 'proposed' | 'quarantined' | 'evaluation_passed' | 'promotion_ready';
  canSelfPromote: false;
};

export type EvaluationEvidence = {
  regression: boolean;
  security: boolean;
  compatibility: boolean;
  provenance: boolean;
  isolation: boolean;
  rollback: boolean;
  domainKpi: boolean;
  humanApproval: boolean;
};

export type ProposalEvaluation = {
  proposal: ImprovementProposal;
  passedAutomatedGates: boolean;
  promotionAllowed: boolean;
  failedGates: string[];
};

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}

export function semanticChecksum(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

export function createIntentLock(input: Omit<IntentLock, 'checksum'>): IntentLock {
  const tenantId = input.tenantId.trim();
  const estimateId = input.estimateId.trim();
  const intent = input.intent.trim();
  if (!tenantId || !estimateId || !intent) throw new Error('intent_lock_fields_required');
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error('intent_lock_revision_invalid');
  return { ...input, tenantId, estimateId, intent, checksum: semanticChecksum({ tenantId, estimateId, revision: input.revision, intent }) };
}

export function assertIntentLock(lock: IntentLock, current: Omit<IntentLock, 'checksum'>): void {
  const expected = createIntentLock(current);
  if (expected.checksum !== lock.checksum) throw new Error('intent_lock_mismatch');
}

export function blastRadiusFor(criticality: MeshCriticality): BlastRadiusPolicy {
  if (criticality === 'safety_critical') return { maxAffectedEntities: 1, requiresTwoKey: true, requiresAdversarialTwin: true, requiresHumanApproval: true };
  if (criticality === 'important') return { maxAffectedEntities: 10, requiresTwoKey: true, requiresAdversarialTwin: false, requiresHumanApproval: true };
  return { maxAffectedEntities: 50, requiresTwoKey: false, requiresAdversarialTwin: false, requiresHumanApproval: true };
}

export function assertBlastRadius(criticality: MeshCriticality, affectedEntities: number): void {
  if (!Number.isSafeInteger(affectedEntities) || affectedEntities < 0) throw new Error('blast_radius_invalid');
  const policy = blastRadiusFor(criticality);
  if (affectedEntities > policy.maxAffectedEntities) throw new Error(`blast_radius_exceeded:${affectedEntities}:${policy.maxAffectedEntities}`);
}

export function runAgentJury(votes: DecisionVote[], criticality: MeshCriticality): JuryDecision {
  const valid = votes.filter((vote) => vote.agentId.trim() && vote.outputKey.trim() && Number.isFinite(vote.confidence));
  if (!valid.length) return { disposition: 'reject', winner: null, agreement: 0, sourceDiversity: 0, twoKeySatisfied: false, vetoes: [], reasons: ['no_valid_votes'] };
  const vetoes = valid.filter((vote) => vote.safetyVeto).map((vote) => vote.agentId);
  const families = new Set(valid.flatMap((vote) => vote.sourceFamilies.map((family) => family.trim()).filter(Boolean)));
  const groups = new Map<string, DecisionVote[]>();
  for (const vote of valid) groups.set(vote.outputKey, [...(groups.get(vote.outputKey) ?? []), vote]);
  const ranked = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || b[1].reduce((s, v) => s + v.confidence, 0) - a[1].reduce((s, v) => s + v.confidence, 0) || a[0].localeCompare(b[0]));
  const winner = ranked[0]?.[0] ?? null;
  const winningVotes = ranked[0]?.[1] ?? [];
  const agreement = valid.length ? winningVotes.length / valid.length : 0;
  const independentKeys = new Set(winningVotes.map((vote) => vote.agentId));
  const twoKeySatisfied = independentKeys.size >= 2;
  const minAgreement = criticality === 'safety_critical' ? 0.8 : criticality === 'important' ? 2 / 3 : 0.5;
  const minSources = criticality === 'safety_critical' ? 2 : 1;
  const reasons: string[] = [];
  if (vetoes.length) reasons.push('safety_veto');
  if (agreement < minAgreement) reasons.push('jury_consensus_not_met');
  if (families.size < minSources) reasons.push('source_diversity_not_met');
  if (blastRadiusFor(criticality).requiresTwoKey && !twoKeySatisfied) reasons.push('two_key_not_met');
  const disposition = vetoes.length || reasons.length ? 'human_review' : 'accept_candidate';
  return { disposition, winner, agreement, sourceDiversity: families.size, twoKeySatisfied, vetoes, reasons };
}

export function adversarialTwinRequired(criticality: MeshCriticality, jury: JuryDecision): boolean {
  return blastRadiusFor(criticality).requiresAdversarialTwin || jury.disposition !== 'accept_candidate';
}

export function quarantineReasons(input: {
  criticality: MeshCriticality;
  jury: JuryDecision;
  stale: boolean;
  semanticDrift: boolean;
  affectedEntities: number;
  failedAgentCount: number;
}): string[] {
  const reasons: string[] = [];
  if (input.stale) reasons.push('stale_state');
  if (input.semanticDrift) reasons.push('semantic_drift');
  if (input.jury.disposition !== 'accept_candidate') reasons.push('jury_not_accepted');
  if (input.failedAgentCount > blastRadiusFor(input.criticality).maxAffectedEntities) reasons.push('failure_domain_exceeded');
  try { assertBlastRadius(input.criticality, input.affectedEntities); } catch { reasons.push('blast_radius_exceeded'); }
  return [...new Set(reasons)];
}

export function recoveryGraph(criticality: MeshCriticality): string[] {
  const base = ['primary', 'shadow-agent', 'harmonization', 'quality-verification', 'recovery-fallback'];
  return criticality === 'safety_critical' ? [...base, 'security-governance', 'human-review'] : [...base, 'human-review'];
}

export function createImprovementProposal(input: {
  id: string;
  kind: ImprovementKind;
  observation: string;
  proposedChange: string;
  evidenceRefs: string[];
  createdAt?: string;
}): ImprovementProposal {
  const id = input.id.trim();
  const observation = input.observation.trim();
  const proposedChange = input.proposedChange.trim();
  if (!id || !observation || !proposedChange) throw new Error('improvement_proposal_fields_required');
  if (!input.evidenceRefs.filter(Boolean).length) throw new Error('improvement_proposal_evidence_required');
  return { id, kind: input.kind, observation, proposedChange, evidenceRefs: [...new Set(input.evidenceRefs.filter(Boolean))], createdAt: input.createdAt ?? new Date().toISOString(), status: 'proposed', canSelfPromote: false };
}

export function evaluateImprovementProposal(proposal: ImprovementProposal, evidence: EvaluationEvidence): ProposalEvaluation {
  const automated: Array<[keyof Omit<EvaluationEvidence, 'humanApproval'>, boolean]> = [
    ['regression', evidence.regression], ['security', evidence.security], ['compatibility', evidence.compatibility],
    ['provenance', evidence.provenance], ['isolation', evidence.isolation], ['rollback', evidence.rollback], ['domainKpi', evidence.domainKpi]
  ];
  const failedGates = automated.filter(([, passed]) => !passed).map(([gate]) => gate);
  const passedAutomatedGates = failedGates.length === 0;
  const status: ImprovementProposal['status'] = !passedAutomatedGates ? 'quarantined' : evidence.humanApproval ? 'promotion_ready' : 'evaluation_passed';
  const evaluated = { ...proposal, status };
  return { proposal: evaluated, passedAutomatedGates, promotionAllowed: passedAutomatedGates && evidence.humanApproval && proposal.canSelfPromote === false, failedGates };
}
