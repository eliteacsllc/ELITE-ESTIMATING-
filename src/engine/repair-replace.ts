import type { Money, SourceProvenance } from '../domain/types.js';

export type RepairOption = {
  laborHours: number;
  laborRate: Money;
  materials?: Money;
  equipment?: Money;
  additionalOperations?: Money;
  cycleTimeDays?: number;
  safetyProcedureSatisfied: boolean;
  qualityRestorationFeasible: boolean;
  provenance: SourceProvenance[];
};

export type ReplaceOption = {
  part: Money;
  laborHours: number;
  laborRate: Money;
  materials?: Money;
  equipment?: Money;
  additionalOperations?: Money;
  leadTimeDays?: number;
  safetyProcedureSatisfied: boolean;
  provenance: SourceProvenance[];
};

export type RepairReplacePolicy = {
  currency: string;
  repairCostRatioThreshold: number;
  maxRepairCycleDays?: number;
  maxReplacementLeadDays?: number;
  safetyCritical?: boolean;
};

export type RepairReplaceDecision = {
  recommendation: 'repair' | 'replace' | 'manual_review';
  repairCost: Money;
  replacementCost: Money;
  repairToReplaceRatio: number;
  confidence: number;
  blockers: string[];
  reasons: string[];
};

function assertMoney(currency: string, values: Array<Money | undefined>): void {
  for (const value of values) if (value && value.currency !== currency) throw new Error('repair_replace_currency_mismatch');
}

function optionTotal(hours: number, rate: Money, extras: Array<Money | undefined>): number {
  return Math.round(hours * rate.amountMinor) + extras.reduce((sum, value) => sum + (value?.amountMinor ?? 0), 0);
}

export function decideRepairOrReplace(repair: RepairOption, replacement: ReplaceOption, policy: RepairReplacePolicy): RepairReplaceDecision {
  if (!/^[A-Z]{3}$/.test(policy.currency)) throw new Error('repair_replace_currency_invalid');
  if (!Number.isFinite(policy.repairCostRatioThreshold) || policy.repairCostRatioThreshold <= 0 || policy.repairCostRatioThreshold > 2) throw new Error('repair_replace_threshold_invalid');
  if (repair.laborHours < 0 || replacement.laborHours < 0) throw new Error('repair_replace_hours_invalid');
  assertMoney(policy.currency, [repair.laborRate,repair.materials,repair.equipment,repair.additionalOperations,replacement.part,replacement.laborRate,replacement.materials,replacement.equipment,replacement.additionalOperations]);

  const repairMinor = optionTotal(repair.laborHours, repair.laborRate, [repair.materials, repair.equipment, repair.additionalOperations]);
  const replacementMinor = replacement.part.amountMinor + optionTotal(replacement.laborHours, replacement.laborRate, [replacement.materials, replacement.equipment, replacement.additionalOperations]);
  if (replacementMinor <= 0) throw new Error('replacement_cost_required');
  const ratio = repairMinor / replacementMinor;
  const blockers: string[] = [];
  const reasons: string[] = [`repair_cost:${repairMinor}`, `replacement_cost:${replacementMinor}`, `repair_replace_ratio:${ratio.toFixed(4)}`];

  if (repair.provenance.length === 0) blockers.push('repair_provenance_required');
  if (replacement.provenance.length === 0) blockers.push('replacement_provenance_required');
  if (!repair.qualityRestorationFeasible) blockers.push('repair_quality_restoration_not_feasible');
  if (!repair.safetyProcedureSatisfied && policy.safetyCritical) blockers.push('repair_safety_procedure_not_satisfied');
  if (!replacement.safetyProcedureSatisfied && policy.safetyCritical) blockers.push('replacement_safety_procedure_not_satisfied');
  if (policy.maxRepairCycleDays !== undefined && (repair.cycleTimeDays ?? Number.POSITIVE_INFINITY) > policy.maxRepairCycleDays) reasons.push('repair_cycle_time_exceeds_policy');
  if (policy.maxReplacementLeadDays !== undefined && (replacement.leadTimeDays ?? Number.POSITIVE_INFINITY) > policy.maxReplacementLeadDays) reasons.push('replacement_lead_time_exceeds_policy');

  let recommendation: RepairReplaceDecision['recommendation'] = 'manual_review';
  if (blockers.some(value => value.startsWith('repair_')) && !blockers.some(value => value.startsWith('replacement_'))) recommendation = 'replace';
  else if (blockers.some(value => value.startsWith('replacement_')) && !blockers.some(value => value.startsWith('repair_'))) recommendation = 'repair';
  else if (blockers.length === 0) {
    if (ratio >= policy.repairCostRatioThreshold) recommendation = 'replace';
    else recommendation = 'repair';
    if (policy.maxRepairCycleDays !== undefined && (repair.cycleTimeDays ?? 0) > policy.maxRepairCycleDays && (replacement.leadTimeDays ?? Number.POSITIVE_INFINITY) <= (policy.maxReplacementLeadDays ?? Number.POSITIVE_INFINITY)) recommendation = 'replace';
    if (policy.maxReplacementLeadDays !== undefined && (replacement.leadTimeDays ?? 0) > policy.maxReplacementLeadDays && (repair.cycleTimeDays ?? Number.POSITIVE_INFINITY) <= (policy.maxRepairCycleDays ?? Number.POSITIVE_INFINITY)) recommendation = 'repair';
  }

  const evidenceCount = repair.provenance.length + replacement.provenance.length;
  const separation = Math.min(1, Math.abs(ratio - policy.repairCostRatioThreshold) / Math.max(0.01, policy.repairCostRatioThreshold));
  const confidence = blockers.length ? 0.25 : Number(Math.min(0.98, 0.55 + Math.min(0.2, evidenceCount * 0.03) + separation * 0.23).toFixed(2));
  reasons.push(`decision_basis:${recommendation}`);

  return {
    recommendation,
    repairCost: { amountMinor: repairMinor, currency: policy.currency },
    replacementCost: { amountMinor: replacementMinor, currency: policy.currency },
    repairToReplaceRatio: Number(ratio.toFixed(4)),
    confidence,
    blockers,
    reasons,
  };
}
