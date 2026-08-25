import type { Estimate } from '../domain/types.js';

export type RepairPlanningChecklist = {
  damageDiscoveryComplete: boolean;
  teardownBlueprintComplete: boolean;
  hiddenDamageReviewed: boolean;
  partsIdentified: boolean;
  oneTimeUseItemsIdentified: boolean;
  oemProceduresReviewed: boolean;
  structuralRequirementsResolved: boolean;
  adasRequirementsResolved: boolean;
  evHvRequirementsResolved: boolean;
  requiredToolsEquipmentConfirmed: boolean;
  technicianCapabilityConfirmed: boolean;
  subletOperationsIdentified: boolean;
  preRepairScanResolved: boolean;
  calibrationPlanResolved: boolean;
  postRepairScanResolved: boolean;
  finalQcPlanResolved: boolean;
  testDriveOrFunctionalValidationResolved: boolean;
  notes?: string;
};

export type RepairPlanningFinding = {
  severity: 'blocker' | 'warning';
  code: string;
  message: string;
};

export function auditRepairPlan(estimate: Estimate, checklist: RepairPlanningChecklist): RepairPlanningFinding[] {
  const findings: RepairPlanningFinding[] = [];
  const require = (ok: boolean, code: string, message: string) => {
    if (!ok) findings.push({ severity: 'blocker', code, message });
  };

  require(checklist.damageDiscoveryComplete, 'damage_discovery_incomplete', 'Complete damage discovery before approval.');
  require(checklist.teardownBlueprintComplete, 'blueprint_incomplete', 'Complete teardown/blueprinting before approval.');
  require(checklist.hiddenDamageReviewed, 'hidden_damage_not_reviewed', 'Review hidden and indirect damage before approval.');
  require(checklist.partsIdentified, 'parts_not_fully_identified', 'Identify all required repair parts before approval.');
  require(checklist.oneTimeUseItemsIdentified, 'one_time_use_items_unresolved', 'Identify clips, fasteners, labels and other one-time-use items.');
  require(checklist.oemProceduresReviewed, 'oem_procedures_not_reviewed', 'Review current OEM repair procedures for the repair plan.');
  require(checklist.requiredToolsEquipmentConfirmed, 'equipment_not_confirmed', 'Confirm required tools, measuring, welding and calibration equipment.');
  require(checklist.technicianCapabilityConfirmed, 'capability_not_confirmed', 'Confirm technician skills/certifications match the repair.');
  require(checklist.subletOperationsIdentified, 'sublet_not_resolved', 'Identify and schedule required sublet operations.');
  require(checklist.finalQcPlanResolved, 'final_qc_not_planned', 'Define final quality-control validation.');
  require(checklist.testDriveOrFunctionalValidationResolved, 'functional_validation_not_planned', 'Define required functional validation or test drive.');

  const hasStructural = estimate.lines.some((line) => line.safetyCritical && /struct|frame|rail|pillar|rocker|apron|support/i.test(`${line.category} ${line.component}`));
  if (hasStructural) require(checklist.structuralRequirementsResolved, 'structural_requirements_unresolved', 'Structural repair requirements must be resolved.');

  const hasAdas = estimate.lines.some((line) => line.operation === 'calibrate' || /adas|radar|camera|lidar|sensor/i.test(`${line.category} ${line.component}`));
  if (hasAdas) {
    require(checklist.adasRequirementsResolved, 'adas_requirements_unresolved', 'ADAS inspection/repair/calibration requirements must be resolved.');
    require(checklist.calibrationPlanResolved, 'calibration_plan_unresolved', 'Required calibration steps must be planned.');
  }

  const hasEvHv = /electric|hybrid|ev|high voltage|hv/i.test(`${estimate.asset.configuration ?? ''} ${estimate.asset.model ?? ''}`) || estimate.lines.some((line) => /high voltage|battery|ev|hybrid/i.test(`${line.category} ${line.component}`));
  if (hasEvHv) require(checklist.evHvRequirementsResolved, 'ev_hv_requirements_unresolved', 'EV/high-voltage safety and isolation requirements must be resolved.');

  const hasDiagnosticNeed = estimate.lines.some((line) => line.operation === 'scan' || line.operation === 'calibrate' || line.safetyCritical);
  if (hasDiagnosticNeed) {
    require(checklist.preRepairScanResolved, 'pre_repair_scan_unresolved', 'Resolve pre-repair diagnostic scan requirements.');
    require(checklist.postRepairScanResolved, 'post_repair_scan_unresolved', 'Resolve post-repair diagnostic scan requirements.');
  }

  return findings;
}

export function assertRepairPlanReady(estimate: Estimate, checklist: RepairPlanningChecklist): RepairPlanningFinding[] {
  const findings = auditRepairPlan(estimate, checklist);
  const blockers = findings.filter((finding) => finding.severity === 'blocker');
  if (blockers.length) throw new Error(`repair_plan_audit_failed:${blockers.map((finding) => finding.code).join('|')}`);
  return findings;
}
