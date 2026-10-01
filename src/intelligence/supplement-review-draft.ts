import type { Estimate } from '../domain/types.js';
import { buildEstimateCompletenessReview } from './estimate-completeness.js';

export type SupplementDraftItem = {
  code: string;
  severity: 'blocker' | 'review' | 'opportunity';
  title: string;
  note: string;
  evidenceRequired: string[];
  relatedLineIds: string[];
  suggestedOperation?: string;
  confidence: number;
  requiresHumanApproval: true;
};

export type SupplementReviewDraft = {
  estimateId: string;
  status: 'ready' | 'needs_review' | 'blocked';
  generatedAt: string;
  disclaimer: string;
  items: SupplementDraftItem[];
};

export function buildSupplementReviewDraft(estimate: Estimate): SupplementReviewDraft {
  const review = buildEstimateCompletenessReview(estimate);
  return {
    estimateId: estimate.id,
    status: review.status,
    generatedAt: new Date().toISOString(),
    disclaimer: 'Draft review notes are decision support only. Verify vehicle-specific OEM procedures, included/not-included operations, estimating-system logic, and claim facts before adding or submitting any supplement.',
    items: review.candidates.map(candidate => ({
      code: candidate.code,
      severity: candidate.severity,
      title: candidate.title,
      note: candidate.supplementNote,
      evidenceRequired: [...candidate.evidenceRequired],
      relatedLineIds: [...candidate.relatedLineIds],
      ...(candidate.suggestedOperation ? { suggestedOperation: candidate.suggestedOperation } : {}),
      confidence: candidate.confidence,
      requiresHumanApproval: true,
    })),
  };
}
