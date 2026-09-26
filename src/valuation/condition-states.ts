export type ValuationConditionState =
  | 'pre_loss_undamaged'
  | 'post_loss_pre_repair'
  | 'post_repair_as_is'
  | 'corrected_operational';

export type EvidenceStrength =
  | 'invoice'
  | 'photo'
  | 'invoice_and_photo'
  | 'inspection'
  | 'owner_reported'
  | 'third_party_report';

export type ConditionStateEvidence = {
  id: string;
  state: ValuationConditionState;
  category:
    | 'identity'
    | 'mechanical'
    | 'structural'
    | 'electrical'
    | 'plumbing'
    | 'interior'
    | 'cosmetic'
    | 'market'
    | 'repair'
    | 'other';
  description: string;
  strength: EvidenceStrength;
  verified: boolean;
  amount?: number;
  source?: string;
  sourceUrl?: string;
  evidenceId?: string;
  observedAt?: string;
};

export type UnresolvedDefect = {
  id: string;
  label: string;
  category:
    | 'mechanical'
    | 'safety'
    | 'electrical'
    | 'plumbing'
    | 'structural'
    | 'interior'
    | 'cosmetic'
    | 'appliance'
    | 'other';
  estimatedCost?: number;
  marketAdjustment?: number;
  evidenceIds?: string[];
  status: 'open' | 'diagnosis_pending' | 'repair_scheduled' | 'not_tested' | 'resolved';
};

export type RepairExpenditure = {
  id: string;
  description: string;
  amount: number;
  category:
    | 'restoration'
    | 'maintenance'
    | 'safety'
    | 'upgrade'
    | 'cosmetic'
    | 'diagnostic'
    | 'other';
  verified: boolean;
  evidenceIds?: string[];
};

export type ConditionStateRecord = {
  state: ValuationConditionState;
  effectiveDate?: string;
  evidence: ConditionStateEvidence[];
  unresolvedDefects?: UnresolvedDefect[];
  repairExpenditures?: RepairExpenditure[];
  notes?: string[];
};

export type ConditionStateAudit = {
  state: ValuationConditionState;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  unresolvedDefectCount: number;
  verifiedRepairSpend: number;
  reportedRepairSpend: number;
  complete: boolean;
  reviewReasons: string[];
};

const round = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function auditConditionState(record: ConditionStateRecord): ConditionStateAudit {
  const evidence = Array.isArray(record.evidence) ? record.evidence : [];
  const repairs = Array.isArray(record.repairExpenditures) ? record.repairExpenditures : [];
  const defects = Array.isArray(record.unresolvedDefects) ? record.unresolvedDefects : [];
  const verifiedEvidenceCount = evidence.filter(e => e.verified).length;
  const verifiedRepairSpend = round(
    repairs.filter(r => r.verified).reduce((sum, r) => sum + Math.max(0, Number(r.amount) || 0), 0),
  );
  const reportedRepairSpend = round(
    repairs.filter(r => !r.verified).reduce((sum, r) => sum + Math.max(0, Number(r.amount) || 0), 0),
  );
  const reviewReasons: string[] = [];
  if (!record.effectiveDate) reviewReasons.push('effective_date_missing');
  if (evidence.length === 0) reviewReasons.push('state_evidence_missing');
  if (verifiedEvidenceCount === 0) reviewReasons.push('verified_state_evidence_missing');
  if (record.state === 'post_repair_as_is' && defects.length === 0) {
    reviewReasons.push('current_condition_defects_not_recorded');
  }
  if (repairs.some(r => !r.verified)) reviewReasons.push('owner_reported_repair_spend_present');

  return {
    state: record.state,
    evidenceCount: evidence.length,
    verifiedEvidenceCount,
    unresolvedDefectCount: defects.filter(d => d.status !== 'resolved').length,
    verifiedRepairSpend,
    reportedRepairSpend,
    complete: reviewReasons.length === 0,
    reviewReasons,
  };
}

export function validateConditionSequence(records: ConditionStateRecord[]): string[] {
  const states = new Set(records.map(r => r.state));
  const reasons: string[] = [];
  if (!states.has('post_loss_pre_repair')) reasons.push('pre_repair_state_missing');
  if (!states.has('post_repair_as_is')) reasons.push('current_as_is_state_missing');
  if (!states.has('corrected_operational')) reasons.push('corrected_operational_state_missing');

  const audits = records.map(auditConditionState);
  for (const audit of audits) {
    for (const reason of audit.reviewReasons) reasons.push(`${audit.state}:${reason}`);
  }

  return [...new Set(reasons)];
}

export function conditionValueDeltas(values: Partial<Record<ValuationConditionState, number>>) {
  const preRepair = Number(values.post_loss_pre_repair);
  const current = Number(values.post_repair_as_is);
  const corrected = Number(values.corrected_operational);
  const preLoss = Number(values.pre_loss_undamaged);

  return {
    repairRecovery:
      Number.isFinite(preRepair) && Number.isFinite(current) ? round(Math.max(0, current - preRepair)) : null,
    remainingValueGap:
      Number.isFinite(current) && Number.isFinite(corrected) ? round(Math.max(0, corrected - current)) : null,
    totalRestorationPotential:
      Number.isFinite(preRepair) && Number.isFinite(corrected) ? round(Math.max(0, corrected - preRepair)) : null,
    residualDiminishedValue:
      Number.isFinite(preLoss) && Number.isFinite(current) ? round(Math.max(0, preLoss - current)) : null,
  };
}
