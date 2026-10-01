import type { ComparableVehicle, SubjectVehicle, AdjustmentPolicy, MoneySource, ValuationResult } from './market-valuation.js';
import { calculateMarketValuation } from './market-valuation.js';

export type DamageAdjustment = {
  label: string;
  amount: number;
  source?: string;
  evidenceId?: string;
};

export type DiminishedValueResult = {
  preLoss: ValuationResult;
  postLossIndicatedValue: number;
  diminishedValue: number;
  damageAdjustments: DamageAdjustment[];
  confidence: number;
  reviewRequired: boolean;
};

const round=(n:number)=>Math.round((Number.isFinite(n)?n:0)*100)/100;

export function calculateDiminishedValue(input:{
  subject:SubjectVehicle;
  comparables:ComparableVehicle[];
  selectedComparableIds?:string[];
  bookSources?:MoneySource[];
  policy?:AdjustmentPolicy;
  blendBookWeight?:number;
  damageAdjustments:DamageAdjustment[];
  postLossMarketEvidence?:number;
}):DiminishedValueResult{
  const preLoss=calculateMarketValuation({
    subject:input.subject,
    comparables:input.comparables,
    ...(input.selectedComparableIds !== undefined ? {selectedComparableIds:input.selectedComparableIds} : {}),
    ...(input.bookSources !== undefined ? {bookSources:input.bookSources} : {}),
    ...(input.policy !== undefined ? {policy:input.policy} : {}),
    ...(input.blendBookWeight !== undefined ? {blendBookWeight:input.blendBookWeight} : {}),
  });
  const evidencePostLoss=Number(input.postLossMarketEvidence);
  const totalDamageAdjustment=input.damageAdjustments.reduce((sum,a)=>sum+Math.max(0,Number(a.amount)||0),0);
  const modeledPostLoss=round(Math.max(0,preLoss.indicatedValue-totalDamageAdjustment));
  const postLossIndicatedValue=Number.isFinite(evidencePostLoss)&&evidencePostLoss>0
    ? round((modeledPostLoss+evidencePostLoss)/2)
    : modeledPostLoss;
  const diminishedValue=round(Math.max(0,preLoss.indicatedValue-postLossIndicatedValue));
  const adjustmentEvidenceRatio=input.damageAdjustments.length
    ? input.damageAdjustments.filter(a=>a.source||a.evidenceId).length/input.damageAdjustments.length
    : 0;
  const confidence=round(Math.max(0,Math.min(100,preLoss.confidence*0.7+adjustmentEvidenceRatio*20+(Number.isFinite(evidencePostLoss)&&evidencePostLoss>0?10:0))));
  return {
    preLoss,
    postLossIndicatedValue,
    diminishedValue,
    damageAdjustments:input.damageAdjustments,
    confidence,
    reviewRequired:confidence<75||diminishedValue<=0,
  };
}
