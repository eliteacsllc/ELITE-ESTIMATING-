import type { ComparableVehicle, SubjectVehicle, AdjustmentPolicy, MoneySource, ValuationResult } from './market-valuation.js';
import { calculateMarketValuation } from './market-valuation.js';
import { auditConditionState, conditionValueDeltas, type ConditionStateRecord, type ValuationConditionState } from './condition-states.js';

export const DV_METHOD_VERSION = 'elite.dv.market-supported.v1.0.0' as const;

export type DamageAdjustment = {
  label: string;
  amount: number;
  source?: string;
  evidenceId?: string;
};

export type DiminishedValueReference = {
  name:'17c_reference';
  amount:number;
  referenceOnly:true;
};

export type DiminishedValueResult = {
  methodVersion: typeof DV_METHOD_VERSION;
  methodology:'market_supported';
  preLoss: ValuationResult;
  modeledPostLossValue:number;
  postLossIndicatedValue: number;
  diminishedValue: number;
  damageAdjustments: DamageAdjustment[];
  references:DiminishedValueReference[];
  confidence: number;
  reviewRequired: boolean;
  reviewReasons:string[];
};

const round=(n:number)=>Math.round((Number.isFinite(n)?n:0)*100)/100;

export function calculate17cReference(input:{preLossValue:number;damageMultiplier?:number;mileageMultiplier?:number}):DiminishedValueReference {
  const base=Math.max(0,Number(input.preLossValue)||0)*0.10;
  const damage=Math.max(0,Math.min(1,Number(input.damageMultiplier??1)));
  const mileage=Math.max(0,Math.min(1,Number(input.mileageMultiplier??1)));
  return {name:'17c_reference',amount:round(base*damage*mileage),referenceOnly:true};
}

export function calculateDiminishedValue(input:{
  subject:SubjectVehicle;
  comparables:ComparableVehicle[];
  selectedComparableIds?:string[];
  bookSources?:MoneySource[];
  policy?:AdjustmentPolicy;
  blendBookWeight?:number;
  damageAdjustments:DamageAdjustment[];
  postLossMarketEvidence?:number;
  include17cReference?:boolean;
  referenceDamageMultiplier?:number;
  referenceMileageMultiplier?:number;
}):DiminishedValueResult{
  const preLoss=calculateMarketValuation({
    subject:input.subject,
    comparables:input.comparables,
    selectedComparableIds:input.selectedComparableIds,
    bookSources:input.bookSources,
    policy:input.policy,
    blendBookWeight:input.blendBookWeight,
  });
  const evidencePostLoss=Number(input.postLossMarketEvidence);
  const totalDamageAdjustment=input.damageAdjustments.reduce((sum,a)=>sum+Math.max(0,Number(a.amount)||0),0);
  const modeledPostLossValue=round(Math.max(0,preLoss.indicatedValue-totalDamageAdjustment));
  const hasPostLossEvidence=Number.isFinite(evidencePostLoss)&&evidencePostLoss>0;
  const postLossIndicatedValue=hasPostLossEvidence
    ? round((modeledPostLossValue+evidencePostLoss)/2)
    : modeledPostLossValue;
  const diminishedValue=round(Math.max(0,preLoss.indicatedValue-postLossIndicatedValue));
  const adjustmentEvidenceRatio=input.damageAdjustments.length
    ? input.damageAdjustments.filter(a=>a.source||a.evidenceId).length/input.damageAdjustments.length
    : 0;
  const confidence=round(Math.max(0,Math.min(100,preLoss.confidence*0.7+adjustmentEvidenceRatio*20+(hasPostLossEvidence?10:0))));
  const reviewReasons:string[]=[];
  if(confidence<75) reviewReasons.push('confidence_below_75');
  if(diminishedValue<=0) reviewReasons.push('no_supported_diminished_value');
  if(input.damageAdjustments.length===0) reviewReasons.push('damage_adjustments_required');
  if(adjustmentEvidenceRatio<0.75) reviewReasons.push('damage_adjustment_evidence_incomplete');
  if(!hasPostLossEvidence) reviewReasons.push('post_loss_market_evidence_missing');
  const references=input.include17cReference
    ? [calculate17cReference({preLossValue:preLoss.indicatedValue,damageMultiplier:input.referenceDamageMultiplier,mileageMultiplier:input.referenceMileageMultiplier})]
    : [];
  return {
    methodVersion:DV_METHOD_VERSION,
    methodology:'market_supported',
    preLoss,
    modeledPostLossValue,
    postLossIndicatedValue,
    diminishedValue,
    damageAdjustments:input.damageAdjustments,
    references,
    confidence,
    reviewRequired:reviewReasons.length>0,
    reviewReasons,
  };
}


export type DiminishedValueFromConditionStatesResult = DiminishedValueResult & {
  conditionValues: Partial<Record<ValuationConditionState, number>>;
  conditionDeltas: ReturnType<typeof conditionValueDeltas>;
  stateAudits: ReturnType<typeof auditConditionState>[];
};

export function calculateDiminishedValueFromConditionStates(input:{
  subject:SubjectVehicle;
  comparables:ComparableVehicle[];
  selectedComparableIds?:string[];
  bookSources?:MoneySource[];
  policy?:AdjustmentPolicy;
  blendBookWeight?:number;
  damageAdjustments:DamageAdjustment[];
  conditionRecords:ConditionStateRecord[];
  conditionValues:Partial<Record<ValuationConditionState,number>>;
  include17cReference?:boolean;
  referenceDamageMultiplier?:number;
  referenceMileageMultiplier?:number;
}):DiminishedValueFromConditionStatesResult {
  const preLossValue=Number(input.conditionValues.pre_loss_undamaged);
  const postRepairValue=Number(input.conditionValues.post_repair_as_is);
  if(!Number.isFinite(preLossValue)||preLossValue<=0) throw new Error('pre_loss_undamaged_value_required');
  if(!Number.isFinite(postRepairValue)||postRepairValue<=0) throw new Error('post_repair_as_is_value_required');

  const result=calculateDiminishedValue({
    subject:input.subject,
    comparables:input.comparables,
    selectedComparableIds:input.selectedComparableIds,
    bookSources:input.bookSources,
    policy:input.policy,
    blendBookWeight:input.blendBookWeight,
    damageAdjustments:input.damageAdjustments,
    postLossMarketEvidence:postRepairValue,
    include17cReference:input.include17cReference,
    referenceDamageMultiplier:input.referenceDamageMultiplier,
    referenceMileageMultiplier:input.referenceMileageMultiplier,
  });

  const stateAudits=input.conditionRecords.map(auditConditionState);
  const conditionDeltas=conditionValueDeltas(input.conditionValues);
  const additionalReasons:string[]=[];
  if(!input.conditionRecords.some(r=>r.state==='pre_loss_undamaged')) additionalReasons.push('pre_loss_condition_record_missing');
  if(!input.conditionRecords.some(r=>r.state==='post_repair_as_is')) additionalReasons.push('post_repair_condition_record_missing');
  if(stateAudits.some(a=>!a.complete)) additionalReasons.push('condition_state_audit_incomplete');

  return {
    ...result,
    reviewRequired:result.reviewRequired||additionalReasons.length>0,
    reviewReasons:[...new Set([...result.reviewReasons,...additionalReasons])],
    conditionValues:input.conditionValues,
    conditionDeltas,
    stateAudits,
  };
}
