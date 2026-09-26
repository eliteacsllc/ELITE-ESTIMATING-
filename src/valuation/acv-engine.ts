import { calculateMarketValuation, type AdjustmentPolicy, type ComparableVehicle, type MoneySource, type SubjectVehicle, type ValuationResult } from './market-valuation.js';
import type { VehicleConditionReview } from '../automotive/vehicle-condition.js';
import { auditConditionState, conditionValueDeltas, validateConditionSequence, type ConditionStateRecord, type ValuationConditionState } from './condition-states.js';

export const ACV_METHOD_VERSION = 'elite.acv.v1.0.0' as const;

export type AcvConditionSummary = {
  confirmedAreas: number;
  evidenceBackedAreas: number;
  unknownAreas: string[];
  monetaryAdjustment: number;
  complete: boolean;
};

export type AcvResult = {
  methodVersion: typeof ACV_METHOD_VERSION;
  valuation: ValuationResult;
  condition: AcvConditionSummary;
  acv: number;
  confidence: number;
  reviewRequired: boolean;
  reviewReasons: string[];
};

const round=(n:number)=>Math.round((Number.isFinite(n)?n:0)*100)/100;

export function summarizeVehicleCondition(items:VehicleConditionReview[] = []):AcvConditionSummary {
  const confirmed=items.filter(x=>Boolean(x.confirmedRating));
  const unknownAreas=confirmed.filter(x=>x.confirmedRating==='unknown').map(x=>x.area);
  const monetaryAdjustment=round(confirmed.reduce((sum,x)=>sum+(Number(x.adjustmentMinor)||0),0));
  const evidenceBackedAreas=confirmed.filter(x=>x.evidenceRefs.length>0).length;
  return {
    confirmedAreas:confirmed.length,
    evidenceBackedAreas,
    unknownAreas,
    monetaryAdjustment,
    complete:confirmed.length>=6 && evidenceBackedAreas>=5 && !unknownAreas.includes('overall'),
  };
}

export function calculateAcv(input:{
  subject:SubjectVehicle;
  comparables:ComparableVehicle[];
  selectedComparableIds?:string[];
  bookSources?:MoneySource[];
  policy?:AdjustmentPolicy;
  blendBookWeight?:number;
  condition?:VehicleConditionReview[];
  minimumComparableCount?:number;
  minimumConfidence?:number;
}):AcvResult {
  const valuation=calculateMarketValuation({
    subject:input.subject,
    comparables:input.comparables,
    selectedComparableIds:input.selectedComparableIds,
    bookSources:input.bookSources,
    policy:input.policy,
    blendBookWeight:input.blendBookWeight,
  });
  const condition=summarizeVehicleCondition(input.condition);
  const acv=round(Math.max(0,valuation.indicatedValue+condition.monetaryAdjustment));
  const selectedCount=valuation.selectedComparableIds.length;
  const minCount=Math.max(1,Number(input.minimumComparableCount??3));
  const minConfidence=Math.max(0,Math.min(100,Number(input.minimumConfidence??75)));
  const reviewReasons:string[]=[];
  if(selectedCount<minCount) reviewReasons.push(`insufficient_comparables:${selectedCount}/${minCount}`);
  if(valuation.confidence<minConfidence) reviewReasons.push(`low_market_confidence:${valuation.confidence}`);
  if(!condition.complete) reviewReasons.push('condition_review_incomplete');
  if(valuation.evidence.some(e=>!e.sourceUrl && e.type==='comparable')) reviewReasons.push('comparable_provenance_incomplete');
  if((input.bookSources??[]).some(s=>!s.licenseRef)) reviewReasons.push('book_source_license_reference_missing');
  const conditionConfidence=condition.complete?100:Math.min(80,condition.evidenceBackedAreas*12);
  const confidence=round(Math.max(0,Math.min(100,valuation.confidence*0.85+conditionConfidence*0.15)));
  return {
    methodVersion:ACV_METHOD_VERSION,
    valuation,
    condition,
    acv,
    confidence,
    reviewRequired:reviewReasons.length>0,
    reviewReasons,
  };
}


export type AcvConditionStateInput = {
  state: ValuationConditionState;
  record: ConditionStateRecord;
  subject: SubjectVehicle;
  comparables: ComparableVehicle[];
  selectedComparableIds?: string[];
  bookSources?: MoneySource[];
  policy?: AdjustmentPolicy;
  blendBookWeight?: number;
  condition?: VehicleConditionReview[];
  minimumComparableCount?: number;
  minimumConfidence?: number;
};

export type AcvAcrossConditionsResult = {
  methodVersion: typeof ACV_METHOD_VERSION;
  states: Partial<Record<ValuationConditionState, AcvResult>>;
  stateAudits: ReturnType<typeof auditConditionState>[];
  values: Partial<Record<ValuationConditionState, number>>;
  deltas: ReturnType<typeof conditionValueDeltas>;
  confidence: number;
  reviewRequired: boolean;
  reviewReasons: string[];
};

export function calculateAcvAcrossConditions(input:{states:AcvConditionStateInput[]}):AcvAcrossConditionsResult {
  const stateResults: Partial<Record<ValuationConditionState, AcvResult>> = {};
  const values: Partial<Record<ValuationConditionState, number>> = {};
  const records = input.states.map(s => s.record);
  const reviewReasons = validateConditionSequence(records);

  for (const state of input.states) {
    if (state.record.state !== state.state) {
      reviewReasons.push(`${state.state}:record_state_mismatch`);
      continue;
    }
    const result = calculateAcv({
      subject: state.subject,
      comparables: state.comparables,
      selectedComparableIds: state.selectedComparableIds,
      bookSources: state.bookSources,
      policy: state.policy,
      blendBookWeight: state.blendBookWeight,
      condition: state.condition,
      minimumComparableCount: state.minimumComparableCount,
      minimumConfidence: state.minimumConfidence,
    });
    stateResults[state.state] = result;
    values[state.state] = result.acv;
    for (const reason of result.reviewReasons) reviewReasons.push(`${state.state}:${reason}`);
  }

  const stateAudits = records.map(auditConditionState);
  const confidences = Object.values(stateResults).map(r => r?.confidence).filter((v):v is number => typeof v === 'number');
  const confidence = round(confidences.length ? confidences.reduce((a,b)=>a+b,0)/confidences.length : 0);
  const deltas = conditionValueDeltas(values);
  return {
    methodVersion: ACV_METHOD_VERSION,
    states: stateResults,
    stateAudits,
    values,
    deltas,
    confidence,
    reviewRequired: reviewReasons.length > 0,
    reviewReasons: [...new Set(reviewReasons)],
  };
}
