export type DraftIQOperation = 'repair' | 'replace' | 'r&i' | 'refinish' | 'inspect' | 'calibrate' | 'scan' | 'other';

export interface DraftIQEvidenceRef {
  id: string;
  kind: 'photo' | 'video' | 'document' | 'measurement' | 'procedure' | 'pricing' | 'observation';
  source?: string;
}

export interface DraftIQCandidate {
  component: string;
  operation: DraftIQOperation;
  description: string;
  laborHours?: number;
  partNumber?: string;
  partPrice?: number;
  confidence: number;
  evidence: DraftIQEvidenceRef[];
  safetyCritical?: boolean;
  rationale?: string[];
}

export interface DraftIQDraftLine extends DraftIQCandidate {
  status: 'suggested' | 'needs-review';
  reviewReasons: string[];
}

export interface DraftIQDraft {
  version: '1.0';
  mode: 'preliminary';
  generatedAt: string;
  confidence: number;
  lines: DraftIQDraftLine[];
  missingEvidence: string[];
  requiresHumanApproval: true;
}

export interface BuildDraftIQInput {
  candidates: DraftIQCandidate[];
  requiredEvidenceKinds?: DraftIQEvidenceRef['kind'][];
  minimumConfidence?: number;
  now?: Date;
}

export function buildDraftIQDraft(input: BuildDraftIQInput): DraftIQDraft {
  const threshold = input.minimumConfidence ?? 0.8;
  if (!Array.isArray(input.candidates)) throw new Error('draftiq_candidates_array_required');
  const lines = input.candidates.map((candidate) => {
    if (!candidate?.component?.trim()) throw new Error('draftiq_component_required');
    if (!candidate?.description?.trim()) throw new Error('draftiq_description_required');
    if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) throw new Error('draftiq_confidence_invalid');
    const evidence = Array.isArray(candidate.evidence) ? candidate.evidence : [];
    const reviewReasons: string[] = [];
    if (candidate.confidence < threshold) reviewReasons.push('confidence_below_threshold');
    if (evidence.length === 0) reviewReasons.push('missing_supporting_evidence');
    if (['repair','refinish','r&i'].includes(candidate.operation) && !Number.isFinite(candidate.laborHours)) reviewReasons.push('labor_time_required');
    if (candidate.operation === 'replace' && !Number.isFinite(candidate.partPrice)) reviewReasons.push('part_pricing_required');
    if (Number.isFinite(candidate.partPrice) && !evidence.some((item) => item.kind === 'pricing')) reviewReasons.push('pricing_provenance_required');
    if (candidate.safetyCritical) {
      reviewReasons.push('safety_critical_operation');
      if (!evidence.some((item) => item.kind === 'procedure')) reviewReasons.push('safety_procedure_required');
    }
    return {
      ...candidate,
      evidence,
      status: reviewReasons.length ? 'needs-review' as const : 'suggested' as const,
      reviewReasons: [...new Set(reviewReasons)],
    };
  });

  const presentKinds = new Set(lines.flatMap((line) => line.evidence.map((item) => item.kind)));
  const missingEvidence = (input.requiredEvidenceKinds ?? [])
    .filter((kind) => !presentKinds.has(kind))
    .map((kind) => `missing_${kind}`);

  const confidence = lines.length
    ? lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length
    : 0;

  return {
    version: '1.0',
    mode: 'preliminary',
    generatedAt: (input.now ?? new Date()).toISOString(),
    confidence,
    lines,
    missingEvidence,
    requiresHumanApproval: true,
  };
}

export function draftIqCanAdvanceToReview(draft: DraftIQDraft): boolean {
  return draft.lines.length > 0 && draft.missingEvidence.length === 0;
}
