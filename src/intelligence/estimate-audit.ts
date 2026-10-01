import type { Estimate } from '../domain/types.js';
import { lineTotal } from '../engine/estimate.js';

export type EstimateAuditFinding = {
  severity: 'blocker' | 'warning';
  code: string;
  lineId?: string;
  message: string;
  evidenceRefs?: string[];
};

export type EstimateAuditResult = {
  green: boolean;
  estimateId: string;
  revision: number;
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
    if (line.total.currency !== estimate.currency || [line.laborRate, line.partOrMaterial, line.equipment, line.tax].some(value => value && value.currency !== estimate.currency)) {
      findings.push({ severity: 'blocker', code: 'currency_mismatch', lineId: line.id, message: 'Line amounts must use the estimate currency.' });
    } else if ([line.laborRate, line.partOrMaterial, line.equipment, line.tax].some(Boolean) && Number.isFinite(line.quantity) && Number.isFinite(line.laborHours ?? 0)) {
      const calculated = lineTotal(line);
      if (calculated.amountMinor !== line.total.amountMinor) findings.push({ severity: 'blocker', code: 'line_arithmetic_mismatch', lineId: line.id, message: `Line total differs from the calculated amount by ${Math.abs(calculated.amountMinor - line.total.amountMinor)} minor units.` });
    }
    if (line.provenance.length === 0) findings.push({ severity: line.safetyCritical ? 'blocker' : 'warning', code: 'missing_provenance', lineId: line.id, message: 'Line has no source provenance.' });
    if (!line.humanApproved) findings.push({ severity: 'blocker', code: 'human_review_required', lineId: line.id, message: 'A qualified reviewer must approve this line.' });
    if (line.safetyCritical && (line.procedureRefs?.length ?? 0) === 0) findings.push({ severity: 'blocker', code: 'safety_procedure_missing', lineId: line.id, message: 'Safety-critical line requires an authoritative procedure reference.' });
    if (line.safetyCritical && !line.humanApproved) findings.push({ severity: 'blocker', code: 'safety_human_approval_missing', lineId: line.id, message: 'Safety-critical line requires qualified human approval.' });
    if (line.aiSuggested && (line.aiConfidence ?? 0) < 0.5) findings.push({ severity: 'warning', code: 'low_confidence_ai_line', lineId: line.id, message: 'AI-suggested line has low confidence.' });
  }

  if (estimate.lines.length === 0) findings.push({ severity: 'blocker', code: 'estimate_empty', message: 'Estimate must contain at least one line before approval.' });
  const subtotal = estimate.lines.reduce((sum, line) => sum + line.total.amountMinor - (line.tax?.amountMinor ?? 0), 0);
  const tax = estimate.lines.reduce((sum, line) => sum + (line.tax?.amountMinor ?? 0), 0);
  if (estimate.subtotal.amountMinor !== subtotal || estimate.tax.amountMinor !== tax || estimate.total.amountMinor !== subtotal + tax || [estimate.subtotal, estimate.tax, estimate.total].some(value => value.currency !== estimate.currency)) {
    findings.push({ severity: 'blocker', code: 'estimate_totals_mismatch', message: 'Estimate subtotal, tax, or grand total does not match saved lines.' });
  }
  if (estimate.status === 'approved' && estimate.lines.some(line => !line.humanApproved)) findings.push({ severity: 'blocker', code: 'approved_estimate_contains_unapproved_lines', message: 'Approved estimate contains one or more unapproved lines.' });

  return { green: !findings.some(finding => finding.severity === 'blocker'), estimateId: estimate.id, revision: estimate.revision, findings };
}
