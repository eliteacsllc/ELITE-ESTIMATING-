import type { EstimateOperation, Money, SourceProvenance } from '../domain/types.js';

export type DamageObservation = {
  id: string;
  component: string;
  category: string;
  severity: 'minor' | 'moderate' | 'severe' | 'unknown';
  confidence: number;
  safetyCritical?: boolean;
  provenance: SourceProvenance[];
};

export type EstimateLineProposal = {
  observationId: string;
  component: string;
  category: string;
  operation: EstimateOperation;
  confidence: number;
  safetyCritical: boolean;
  requiresHumanReview: boolean;
  requiresAuthoritativeProcedure: boolean;
  provisionalTotal?: Money;
  provenance: SourceProvenance[];
};

export type ProposalPolicy = {
  autoDraftMinimumConfidence: number;
  safetyMinimumConfidence: number;
};

function operationForSeverity(severity: DamageObservation['severity']): EstimateOperation {
  if (severity === 'minor') return 'repair';
  if (severity === 'moderate') return 'repair';
  if (severity === 'severe') return 'replace';
  return 'inspect';
}

export function proposeEstimateLines(observations: DamageObservation[], policy: ProposalPolicy): EstimateLineProposal[] {
  if (policy.autoDraftMinimumConfidence < 0 || policy.autoDraftMinimumConfidence > 1) throw new Error('proposal_confidence_threshold_invalid');
  if (policy.safetyMinimumConfidence < 0 || policy.safetyMinimumConfidence > 1) throw new Error('proposal_safety_threshold_invalid');

  return observations.map(observation => {
    if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) throw new Error(`proposal_observation_confidence_invalid:${observation.id}`);
    const safety = observation.safetyCritical === true;
    const requiresHumanReview = safety || observation.confidence < policy.autoDraftMinimumConfidence || observation.provenance.length === 0;
    return {
      observationId: observation.id,
      component: observation.component,
      category: observation.category,
      operation: operationForSeverity(observation.severity),
      confidence: observation.confidence,
      safetyCritical: safety,
      requiresHumanReview,
      requiresAuthoritativeProcedure: safety,
      provenance: observation.provenance,
    };
  });
}

export function canPromoteProposal(proposal: EstimateLineProposal, procedureVerified: boolean, humanApproved: boolean, policy: ProposalPolicy): boolean {
  if (proposal.safetyCritical) return humanApproved && procedureVerified && proposal.confidence >= policy.safetyMinimumConfidence;
  if (proposal.requiresHumanReview) return humanApproved;
  return proposal.confidence >= policy.autoDraftMinimumConfidence;
}
