import type { Estimate, EstimateLine, EstimateOperation } from '../domain/types.js';
import { buildEstimateIntelligenceGraph } from '../damage/estimate-graph.js';
import { lineIntelligence, type DamageGraphNode } from '../damage/graph.js';
import { buildEstimateCompletenessReview, type EstimateCompletenessCandidate } from './estimate-completeness.js';

export type ComponentIntelligence = {
  lineId: string;
  category: string;
  component: string;
  operation: EstimateOperation;
  quantity: number;
  laborHours: number | null;
  totalMinor: number;
  currency: string;
  humanApproved: boolean;
  aiSuggested: boolean;
  confidence: number | null;
  safetyCritical: boolean;
  procedureRefs: string[];
  evidence: Array<{
    provider: string;
    sourceId?: string;
    licenseClass: string;
    confidence?: number;
    retrievedAt: string;
  }>;
  related: {
    diagnostics: string[];
    calibrations: string[];
    measurements: string[];
    procedures: string[];
  };
  reviewCandidates: EstimateCompletenessCandidate[];
  releaseState: 'approved' | 'human_review_required' | 'evidence_required';
  rationale: string[];
};

export type ComponentIntelligenceWorkspace = {
  estimateId: string;
  revision: number;
  graphValid: boolean;
  graphValidationErrors: string[];
  components: ComponentIntelligence[];
  summary: {
    totalComponents: number;
    safetyCritical: number;
    humanReviewRequired: number;
    evidenceRequired: number;
  };
};

function labels(nodes: DamageGraphNode[], type: DamageGraphNode['type']): string[] {
  return [...new Set(nodes.filter(node => node.type === type).map(node => node.label).filter(Boolean))];
}

function candidateRationale(candidates: EstimateCompletenessCandidate[]): string[] {
  return candidates.map(candidate => candidate.reason);
}

function releaseState(line: EstimateLine, candidates: EstimateCompletenessCandidate[]): ComponentIntelligence['releaseState'] {
  if (!line.provenance.length || candidates.some(candidate => candidate.evidenceRequired.length > 0 && candidate.severity === 'blocker')) {
    return 'evidence_required';
  }
  if (!line.humanApproved || line.aiSuggested || candidates.some(candidate => candidate.severity !== 'opportunity')) {
    return 'human_review_required';
  }
  return 'approved';
}

export function buildComponentIntelligenceWorkspace(estimate: Estimate): ComponentIntelligenceWorkspace {
  const { graph, validationErrors } = buildEstimateIntelligenceGraph(estimate);
  const completeness = buildEstimateCompletenessReview(estimate);

  const components = estimate.lines.map((line): ComponentIntelligence => {
    const nodes = lineIntelligence(graph, line.id);
    const candidates = completeness.candidates.filter(candidate => candidate.relatedLineIds.includes(line.id));
    const state = releaseState(line, candidates);

    const rationale = [
      ...candidateRationale(candidates),
      ...(line.aiSuggested ? ['AI-assisted line: qualified human approval is required before release.'] : []),
      ...(!line.provenance.length ? ['No source provenance is attached to this line.'] : []),
      ...(line.safetyCritical && !(line.procedureRefs?.length) ? ['Safety-critical line has no procedure reference attached.'] : []),
    ];

    return {
      lineId: line.id,
      category: line.category,
      component: line.component,
      operation: line.operation,
      quantity: line.quantity,
      laborHours: line.laborHours ?? null,
      totalMinor: line.total.amountMinor,
      currency: line.total.currency,
      humanApproved: line.humanApproved,
      aiSuggested: line.aiSuggested ?? false,
      confidence: line.aiConfidence ?? null,
      safetyCritical: line.safetyCritical ?? false,
      procedureRefs: line.procedureRefs ?? [],
      evidence: line.provenance.map(source => ({
        provider: source.provider,
        ...(source.sourceId ? { sourceId: source.sourceId } : {}),
        licenseClass: source.licenseClass,
        ...(source.confidence !== undefined ? { confidence: source.confidence } : {}),
        retrievedAt: source.retrievedAt,
      })),
      related: {
        diagnostics: labels(nodes, 'diagnostic'),
        calibrations: labels(nodes, 'calibration'),
        measurements: labels(nodes, 'measurement'),
        procedures: labels(nodes, 'procedure'),
      },
      reviewCandidates: candidates,
      releaseState: state,
      rationale,
    };
  });

  return {
    estimateId: estimate.id,
    revision: estimate.revision,
    graphValid: validationErrors.length === 0,
    graphValidationErrors: validationErrors,
    components,
    summary: {
      totalComponents: components.length,
      safetyCritical: components.filter(component => component.safetyCritical).length,
      humanReviewRequired: components.filter(component => component.releaseState === 'human_review_required').length,
      evidenceRequired: components.filter(component => component.releaseState === 'evidence_required').length,
    },
  };
}
