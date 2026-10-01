import type { Estimate, EstimateLine, EstimateOperation } from '../domain/types.js';
import { auditEstimateIntelligence } from './estimate-audit.js';
import { scoreSupplementRisk } from './supplement-risk.js';

export type CompletenessSeverity = 'blocker' | 'review' | 'opportunity';

export type EstimateCompletenessCandidate = {
  code: string;
  severity: CompletenessSeverity;
  title: string;
  reason: string;
  relatedLineIds: string[];
  evidenceRequired: string[];
  suggestedOperation?: EstimateOperation;
  supplementNote: string;
  confidence: number;
  sourceMode: 'estimate_evidence' | 'heuristic_review';
};

export type EstimateCompletenessReview = {
  estimateId: string;
  score: number;
  status: 'ready' | 'needs_review' | 'blocked';
  requiresHumanReview: true;
  auditGreen: boolean;
  supplementRisk: ReturnType<typeof scoreSupplementRisk>;
  candidates: EstimateCompletenessCandidate[];
  summary: {
    blockers: number;
    reviews: number;
    opportunities: number;
  };
};

const TEXT = {
  electronics: /adas|radar|camera|sensor|module|airbag|srs|electrical|steering angle|blind spot|lane|windshield/i,
  calibration: /adas|radar|camera|sensor|calibrat|windshield|steering angle|blind spot|lane/i,
  structural: /structur|frame|rail|apron|pillar|rocker|quarter|floor|section|weld|unibody/i,
  corrosion: /quarter|rocker|rail|pillar|apron|floor|panel|weld|section|replace|refinish/i,
};

function lineText(line: EstimateLine): string {
  return `${line.category} ${line.component} ${line.operation}`.trim();
}

function matchingLineIds(lines: EstimateLine[], pattern: RegExp): string[] {
  return lines.filter(line => pattern.test(lineText(line))).map(line => line.id);
}

function hasOperation(lines: EstimateLine[], operation: EstimateOperation): boolean {
  return lines.some(line => line.operation === operation);
}

function hasText(lines: EstimateLine[], pattern: RegExp): boolean {
  return lines.some(line => pattern.test(lineText(line)));
}

function pushUnique(target: EstimateCompletenessCandidate[], candidate: EstimateCompletenessCandidate): void {
  if (!target.some(existing => existing.code === candidate.code)) target.push(candidate);
}

function auditCandidates(estimate: Estimate): EstimateCompletenessCandidate[] {
  const audit = auditEstimateIntelligence(estimate);
  return audit.findings.map((finding): EstimateCompletenessCandidate => ({
    code: `audit:${finding.code}`,
    severity: finding.severity === 'blocker' ? 'blocker' : 'review',
    title: finding.code.replaceAll('_', ' '),
    reason: finding.message,
    relatedLineIds: finding.lineId ? [finding.lineId] : [],
    evidenceRequired: finding.code.includes('procedure')
      ? ['Authoritative vehicle-specific procedure reference']
      : finding.code.includes('provenance')
        ? ['Authorized source provenance']
        : finding.code.includes('approval')
          ? ['Qualified human approval']
          : ['Estimator review'],
    supplementNote: `Estimate QA review: ${finding.message} Resolve and document this item before final release.`,
    confidence: 1,
    sourceMode: 'estimate_evidence',
  }));
}

function heuristicCandidates(estimate: Estimate): EstimateCompletenessCandidate[] {
  const lines = estimate.lines;
  const candidates: EstimateCompletenessCandidate[] = [];

  const electronicsIds = matchingLineIds(lines, TEXT.electronics);
  if (electronicsIds.length && !hasOperation(lines, 'scan')) {
    pushUnique(candidates, {
      code: 'review:diagnostic_scan',
      severity: 'review',
      title: 'Verify pre/post diagnostic scan requirements',
      reason: 'The estimate contains electronic, restraint, sensor, camera, radar, or ADAS-related work but no scan operation is present.',
      relatedLineIds: electronicsIds,
      evidenceRequired: ['Vehicle-specific OEM scan requirements', 'Pre-scan/post-scan report or documented exception'],
      suggestedOperation: 'scan',
      supplementNote: 'Review OEM requirements for diagnostic scanning related to the affected electronic/ADAS systems. If required and not already included elsewhere, add the applicable pre-scan/post-scan operation and attach the supporting scan documentation.',
      confidence: 0.84,
      sourceMode: 'heuristic_review',
    });
  }

  const calibrationIds = matchingLineIds(lines, TEXT.calibration);
  if (calibrationIds.length && !hasOperation(lines, 'calibrate')) {
    pushUnique(candidates, {
      code: 'review:calibration',
      severity: 'review',
      title: 'Verify calibration requirements',
      reason: 'Potential calibration-triggering components are present but no calibration operation is listed.',
      relatedLineIds: calibrationIds,
      evidenceRequired: ['Vehicle-specific OEM calibration procedure', 'Calibration report when performed'],
      suggestedOperation: 'calibrate',
      supplementNote: 'Verify whether the affected component or repair procedure triggers an OEM calibration requirement. If required and not already included, add the applicable calibration operation with the supporting OEM procedure and completion report.',
      confidence: 0.82,
      sourceMode: 'heuristic_review',
    });
  }

  const structuralIds = matchingLineIds(lines, TEXT.structural);
  if (structuralIds.length && !hasOperation(lines, 'measure')) {
    pushUnique(candidates, {
      code: 'review:structural_measurement',
      severity: 'review',
      title: 'Verify structural measurement/setup',
      reason: 'Structural or sectioning-related work is present but no measurement operation is listed.',
      relatedLineIds: structuralIds,
      evidenceRequired: ['OEM structural repair procedure', 'Measurement/setup documentation or documented exception'],
      suggestedOperation: 'measure',
      supplementNote: 'Review the repair plan for required structural setup and measurement. If required by the OEM procedure or repair methodology and not already included, add the applicable measurement/setup operation and retain the measurement documentation.',
      confidence: 0.8,
      sourceMode: 'heuristic_review',
    });
  }

  const corrosionIds = matchingLineIds(lines, TEXT.corrosion);
  const hasCorrosionLine = hasText(lines, /corrosion|cavity wax|seam sealer|anti.?corrosion|rustproof|weld.?through/i);
  if (corrosionIds.length && !hasCorrosionLine) {
    pushUnique(candidates, {
      code: 'review:corrosion_protection',
      severity: 'opportunity',
      title: 'Verify corrosion-protection operations',
      reason: 'Panel replacement/refinish/structural work can require corrosion-protection steps, but none are explicitly represented in the estimate text.',
      relatedLineIds: corrosionIds,
      evidenceRequired: ['OEM corrosion-protection requirements', 'Product/process documentation when applicable'],
      supplementNote: 'Review the OEM repair procedure for required corrosion-protection steps associated with the repaired/replaced panels. If required and not already included in another line, add the applicable corrosion-protection materials/labor and cite the supporting procedure.',
      confidence: 0.7,
      sourceMode: 'heuristic_review',
    });
  }

  return candidates;
}

export function buildEstimateCompletenessReview(estimate: Estimate): EstimateCompletenessReview {
  const audit = auditEstimateIntelligence(estimate);
  const supplementRisk = scoreSupplementRisk(estimate);
  const candidates = [...auditCandidates(estimate), ...heuristicCandidates(estimate)];

  const blockers = candidates.filter(item => item.severity === 'blocker').length;
  const reviews = candidates.filter(item => item.severity === 'review').length;
  const opportunities = candidates.filter(item => item.severity === 'opportunity').length;

  const penalty = Math.min(100, blockers * 24 + reviews * 8 + opportunities * 3);
  const score = Math.max(0, 100 - penalty);
  const status: EstimateCompletenessReview['status'] = blockers > 0 ? 'blocked' : (reviews > 0 || opportunities > 0) ? 'needs_review' : 'ready';

  return {
    estimateId: estimate.id,
    score,
    status,
    requiresHumanReview: true,
    auditGreen: audit.green,
    supplementRisk,
    candidates,
    summary: { blockers, reviews, opportunities },
  };
}
