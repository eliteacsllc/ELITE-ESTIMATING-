import type { EstimateLine } from '../domain/types.js';

export type MotorGuideSource = 'motor_gte' | 'motor_raced' | 'oem_procedure' | 'other';
export type PartBasis = 'new_oem' | 'recycled_assembly' | 'aftermarket' | 'repaired_existing' | 'none';
export type WorkTimeBasis = 'database' | 'footnote' | 'estimator_override' | 'manual_entry';

export type MotorGuideContext = {
  source: MotorGuideSource;
  revision?: string;
  partBasis: PartBasis;
  workTimeBasis: WorkTimeBasis;
  footnoteRefs?: string[];
  includedLineIds?: string[];
  notIncludedLineIds?: string[];
  requiredLineIds?: string[];
  assemblyComponents?: string[];
  originalLaborHours?: number;
  overrideReason?: string;
};

export type MotorGuideFinding = {
  severity: 'blocker' | 'warning' | 'info';
  code: string;
  lineId: string;
  message: string;
};

const motorSources = new Set<MotorGuideSource>(['motor_gte', 'motor_raced']);

function normalizedRefs(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function auditMotorGuideLines(lines: EstimateLine[]): MotorGuideFinding[] {
  const findings: MotorGuideFinding[] = [];
  const lineIds = new Set(lines.map((line) => line.id));

  for (const line of lines) {
    const guide = line.guide;
    if (!guide) continue;

    if (guide.source === 'motor_raced' && guide.partBasis !== 'recycled_assembly') {
      findings.push({ severity: 'blocker', code: 'raced_requires_recycled_assembly', lineId: line.id, message: 'MOTOR RACED basis may only be used for a recycled assembly.' });
    }
    if (guide.partBasis === 'recycled_assembly' && guide.source === 'motor_gte') {
      findings.push({ severity: 'blocker', code: 'recycled_requires_raced_or_other_recycled_source', lineId: line.id, message: 'A recycled assembly cannot use the new-part MOTOR GTE basis.' });
    }

    const footnotes = normalizedRefs(guide.footnoteRefs);
    if (guide.workTimeBasis === 'footnote' && footnotes.length === 0) {
      findings.push({ severity: 'blocker', code: 'footnote_reference_required', lineId: line.id, message: 'A footnote-based time or inclusion decision must retain the controlling footnote reference.' });
    }

    if ((guide.workTimeBasis === 'estimator_override' || guide.workTimeBasis === 'manual_entry') && !guide.overrideReason?.trim()) {
      findings.push({ severity: 'blocker', code: 'override_reason_required', lineId: line.id, message: 'Estimator overrides and manual entries require a documented reason.' });
    }

    if (guide.originalLaborHours !== undefined && line.laborHours !== undefined && guide.originalLaborHours !== line.laborHours && !guide.overrideReason?.trim()) {
      findings.push({ severity: 'blocker', code: 'labor_override_reason_required', lineId: line.id, message: 'Changed database labor must retain the original labor value and an override reason.' });
    }

    for (const requiredId of normalizedRefs(guide.requiredLineIds)) {
      if (!lineIds.has(requiredId)) findings.push({ severity: 'blocker', code: 'required_operation_missing', lineId: line.id, message: `Required estimate line ${requiredId} is missing.` });
    }

    for (const includedId of normalizedRefs(guide.includedLineIds)) {
      if (lineIds.has(includedId)) findings.push({ severity: 'blocker', code: 'included_operation_duplicated', lineId: line.id, message: `Estimate line ${includedId} is already included in ${line.id} and must not be charged twice.` });
    }

    for (const notIncludedId of normalizedRefs(guide.notIncludedLineIds)) {
      if (!lineIds.has(notIncludedId)) findings.push({ severity: 'warning', code: 'not_included_operation_review', lineId: line.id, message: `Operation ${notIncludedId} is identified as not included; review whether it is required for the actual repair.` });
    }

    if (guide.source === 'motor_raced' && (guide.assemblyComponents?.length ?? 0) === 0) {
      findings.push({ severity: 'warning', code: 'raced_assembly_contents_unrecorded', lineId: line.id, message: 'Record the recycled assembly contents so included component labor is auditable.' });
    }

    if (motorSources.has(guide.source) && !line.provenance.some((source) => source.provider.toLowerCase().includes('motor'))) {
      findings.push({ severity: 'blocker', code: 'motor_provenance_required', lineId: line.id, message: 'A MOTOR-based estimating decision requires MOTOR source provenance.' });
    }

    if (line.safetyCritical && (line.procedureRefs?.length ?? 0) === 0) {
      findings.push({ severity: 'blocker', code: 'oem_procedure_required_for_safety_line', lineId: line.id, message: 'Safety-critical work requires an authoritative procedure reference in addition to estimating-guide data.' });
    }
  }

  return findings;
}

export function assertNoMotorGuideBlockers(lines: EstimateLine[]): MotorGuideFinding[] {
  const findings = auditMotorGuideLines(lines);
  const blockers = findings.filter((finding) => finding.severity === 'blocker');
  if (blockers.length) throw new Error(`motor_guide_audit_failed:${blockers.map((finding) => `${finding.code}:${finding.lineId}`).join('|')}`);
  return findings;
}
