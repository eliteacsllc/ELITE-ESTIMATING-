import type { Estimate } from '../domain/types.js';

export type EstimateAuditFinding = {
  severity: 'blocker' | 'warning';
  code: string;
  lineId?: string;
  message: string;
};

export type EstimateAuditResult = {
  green: boolean;
  findings: EstimateAuditFinding[];
};

function key(category: string, component: string, operation: string): string {
  return `${category.trim().toLowerCase()}|${component.trim().toLowerCase()}|${operation}`;
}

export function auditEstimateIntelligence(estimate: Estimate): EstimateAuditResult {
  const findings: EstimateAuditFinding[] = [];
  const seen = new Map<string, string>();

  for (const line of estimate.lines) {
    const lineKey = key(line.category, line.component, line.operation);
    const prior = seen.get(lineKey);
    if (prior) findings.push({ severity: 'warning', code: 'possible_duplicate_line', lineId: line.id, message: `Possible duplicate of ${prior}.` });
    else seen.set(lineKey, line.id);

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) findings.push({ severity: 'blocker', code: 'invalid_quantity', lineId: line.id, message: 'Line quantity must be positive.' });
    if (!Number.isSafeInteger(line.total.amountMinor) || line.total.amountMinor < 0) findings.push({ severity: 'blocker', code: 'invalid_line_total', lineId: line.id, message: 'Line total must be a non-negative integer amount.' });
    if (line.provenance.length === 0) findings.push({ severity: line.safetyCritical ? 'blocker' : 'warning', code: 'missing_provenance', lineId: line.id, message: 'Line has no source provenance.' });
    if (line.safetyCritical && (line.procedureRefs?.length ?? 0) === 0) findings.push({ severity: 'blocker', code: 'safety_procedure_missing', lineId: line.id, message: 'Safety-critical line requires an authoritative procedure reference.' });
    if (line.safetyCritical && !line.humanApproved) findings.push({ severity: 'blocker', code: 'safety_human_approval_missing', lineId: line.id, message: 'Safety-critical line requires qualified human approval.' });
    if (line.aiSuggested && (line.aiConfidence ?? 0) < 0.5) findings.push({ severity: 'warning', code: 'low_confidence_ai_line', lineId: line.id, message: 'AI-suggested line has low confidence.' });
  }

  if (estimate.lines.length === 0) findings.push({ severity: 'blocker', code: 'estimate_empty', message: 'Estimate must contain at least one line before approval.' });
  if (estimate.status === 'approved' && estimate.lines.some(line => !line.humanApproved)) findings.push({ severity: 'blocker', code: 'approved_estimate_contains_unapproved_lines', message: 'Approved estimate contains one or more unapproved lines.' });

  return { green: !findings.some(finding => finding.severity === 'blocker'), findings };
}
