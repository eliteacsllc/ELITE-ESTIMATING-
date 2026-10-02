import type { DraftIQCandidate } from '../intelligence/draftiq.js';

export type DamageIqDraftCandidate = {
  observationId: string;
  component: string;
  suggestedOperation: 'repair' | 'replace' | 'inspect';
  confidence: number;
  evidenceIds: string[];
  requiresProcedureLookup: boolean;
  requiresHumanReview: boolean;
  reasons: string[];
};

export function damageIqCandidatesToDraftIQ(candidates: DamageIqDraftCandidate[]): DraftIQCandidate[] {
  if (!Array.isArray(candidates)) throw new Error('damage_iq_candidates_array_required');
  return candidates.map((candidate) => {
    if (!candidate.observationId?.trim()) throw new Error('damage_iq_observation_id_required');
    if (!candidate.component?.trim()) throw new Error('damage_iq_component_required');
    return {
      component: candidate.component.trim(),
      operation: candidate.suggestedOperation,
      description: `${candidate.suggestedOperation} ${candidate.component}`,
      confidence: Number(candidate.confidence),
      evidence: (candidate.evidenceIds ?? []).map((id) => ({
        id: String(id),
        kind: 'photo' as const,
        source: 'elite-damage-iq',
      })),
      safetyCritical: candidate.reasons?.includes('safety_critical_component') || undefined,
      rationale: [
        `damage_iq_observation:${candidate.observationId}`,
        ...(candidate.reasons ?? []),
        ...(candidate.requiresProcedureLookup ? ['procedure_lookup_required'] : []),
        ...(candidate.requiresHumanReview ? ['damage_iq_human_review_required'] : []),
      ],
    };
  });
}
