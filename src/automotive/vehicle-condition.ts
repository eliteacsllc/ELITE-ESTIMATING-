export type ConditionRating='excellent'|'above_average'|'average'|'below_average'|'poor'|'unknown';
export type ConditionArea='exterior'|'interior'|'mechanical'|'tires_wheels'|'glass'|'paint_body'|'upholstery_trim'|'prior_damage_repairs'|'maintenance_history'|'equipment_options'|'keys_accessories'|'overall';

export type VehicleConditionReview={
  area:ConditionArea;
  suggestedRating?:ConditionRating;
  confirmedRating?:ConditionRating;
  evidenceRefs:string[];
  notes?:string;
  adjustmentMinor?:number;
  confidence?:number;
  reviewedBy?:string;
  reviewedAt?:string;
};

export function confirmCondition(item:VehicleConditionReview, reviewerId:string, rating:ConditionRating, notes?:string):VehicleConditionReview{
  if(!reviewerId.trim())throw new Error('condition_reviewer_required');
  if(!item.evidenceRefs.length && rating!=='unknown')throw new Error('condition_evidence_required');
  return {...item,confirmedRating:rating,...(notes!==undefined?{notes}:{}),reviewedBy:reviewerId,reviewedAt:new Date().toISOString()};
}

export type EstimateQaExport={
  estimateId:string;claimId:string;tenantId:string;revision:number;submittedBy:string;
  snapshotRef:string;condition:VehicleConditionReview[];valuationEvidenceRefs:string[];
  finalLockAllowed:false;
};

export function buildEstimateQaExport(input:Omit<EstimateQaExport,'finalLockAllowed'>):EstimateQaExport{
  if(!input.estimateId||!input.claimId||!input.tenantId||!input.submittedBy)throw new Error('estimate_qa_identity_required');
  if(!Number.isInteger(input.revision)||input.revision<1)throw new Error('estimate_revision_invalid');
  if(!input.snapshotRef)throw new Error('estimate_snapshot_required');
  return {...input,valuationEvidenceRefs:[...new Set(input.valuationEvidenceRefs)],finalLockAllowed:false};
}
