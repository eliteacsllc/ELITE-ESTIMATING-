export type WorkspaceMode = 'guided' | 'professional' | 'field' | 'ai-assisted';

export type CheckState = 'pass' | 'warning' | 'blocked' | 'pending';

export interface CompletenessCheck {
  id: string;
  label: string;
  weight: number;
  state: CheckState;
  evidenceCount: number;
  explanation: string;
}

export interface WorkspaceScore {
  score: number;
  releasable: boolean;
  blockers: CompletenessCheck[];
  warnings: CompletenessCheck[];
}

export interface EstimateLineIntelligence {
  lineId: string;
  operation: string;
  component: string;
  source: 'oem' | 'licensed-guide' | 'deg' | 'estimator' | 'provider' | 'internal-rule';
  sourceReference: string;
  confidence: number;
  safetyCritical: boolean;
  evidenceRequired: boolean;
  rationale: string;
}

export interface TotalLossSignal {
  repairTotal: number;
  predictedSupplement: number;
  acv: number;
  projectedRatio: number;
  threshold: number;
  requiresReview: boolean;
}

export interface EstimateRevisionDelta {
  added: number;
  removed: number;
  changed: number;
  priceChanged: number;
  laborChanged: number;
  procedureConflicts: number;
}

export function calculateCompleteness(checks: CompletenessCheck[]): WorkspaceScore {
  if (checks.length === 0) {
    return { score: 0, releasable: false, blockers: [], warnings: [] };
  }

  const totalWeight = checks.reduce((sum, check) => sum + Math.max(0, check.weight), 0);
  const earned = checks.reduce((sum, check) => {
    const factor = check.state === 'pass' ? 1 : check.state === 'warning' ? 0.65 : check.state === 'pending' ? 0.25 : 0;
    return sum + Math.max(0, check.weight) * factor;
  }, 0);

  const blockers = checks.filter((check) => check.state === 'blocked');
  const warnings = checks.filter((check) => check.state === 'warning' || check.state === 'pending');
  const score = totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  return {
    score,
    releasable: blockers.length === 0 && score >= 90,
    blockers,
    warnings,
  };
}

export function evaluateTotalLossSignal(
  repairTotal: number,
  predictedSupplement: number,
  acv: number,
  threshold = 0.7,
): TotalLossSignal {
  const safeAcv = Math.max(acv, 0);
  const projected = Math.max(repairTotal, 0) + Math.max(predictedSupplement, 0);
  const projectedRatio = safeAcv === 0 ? 0 : projected / safeAcv;

  return {
    repairTotal: Math.max(repairTotal, 0),
    predictedSupplement: Math.max(predictedSupplement, 0),
    acv: safeAcv,
    projectedRatio,
    threshold,
    requiresReview: safeAcv > 0 && projectedRatio >= threshold,
  };
}

export function canAutoApplyRecommendation(recommendation: EstimateLineIntelligence): boolean {
  // Human-governed by design: recommendations may be suggested, never silently applied.
  return false;
}

export function recommendationRequiresHumanReview(recommendation: EstimateLineIntelligence): boolean {
  return recommendation.safetyCritical || recommendation.evidenceRequired || recommendation.confidence < 0.95;
}
