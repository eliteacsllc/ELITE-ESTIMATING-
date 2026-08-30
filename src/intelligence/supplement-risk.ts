import type { Estimate } from '../domain/types.js';

export type SupplementRiskBand = 'low' | 'medium' | 'high';

export type SupplementRiskResult = {
  score: number;
  band: SupplementRiskBand;
  reasons: string[];
};

export function scoreSupplementRisk(estimate: Estimate): SupplementRiskResult {
  let score = 0;
  const reasons: string[] = [];
  const lines = estimate.lines;

  if (lines.length === 0) {
    return { score: 100, band: 'high', reasons: ['no_estimate_lines'] };
  }

  const unapproved = lines.filter(line => !line.humanApproved).length;
  if (unapproved > 0) {
    score += Math.min(25, unapproved * 5);
    reasons.push(`unapproved_lines:${unapproved}`);
  }

  const lowConfidence = lines.filter(line => line.aiSuggested && (line.aiConfidence ?? 0) < 0.8).length;
  if (lowConfidence > 0) {
    score += Math.min(20, lowConfidence * 4);
    reasons.push(`low_confidence_ai_lines:${lowConfidence}`);
  }

  const safetyWithoutProcedure = lines.filter(line => line.safetyCritical && (line.procedureRefs?.length ?? 0) === 0).length;
  if (safetyWithoutProcedure > 0) {
    score += 35;
    reasons.push(`safety_lines_missing_procedure:${safetyWithoutProcedure}`);
  }

  const weakProvenance = lines.filter(line => line.provenance.length === 0).length;
  if (weakProvenance > 0) {
    score += Math.min(20, weakProvenance * 4);
    reasons.push(`lines_missing_provenance:${weakProvenance}`);
  }

  if (!estimate.repairPlan) {
    score += 10;
    reasons.push('repair_plan_missing');
  }

  score = Math.min(100, score);
  const band: SupplementRiskBand = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { score, band, reasons };
}
