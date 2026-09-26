import type {ValuationResult} from './market-valuation.js';
import type {DiminishedValueResult} from './diminished-value.js';
import type {AcvAcrossConditionsResult, AcvResult} from './acv-engine.js';
import type {ValuationConditionState} from './condition-states.js';

export type ReportPacket={
  reportType:'fair_market_value'|'acv'|'diminished_value';
  generatedAt:string;
  methodVersion?:string;
  subject:{vin?:string;year?:number;make?:string;model?:string;trim?:string;mileage?:number};
  summary:{indicatedValue:number;confidence:number;reviewRequired:boolean;reviewReasons?:string[]};
  methodology:string[];
  comparables:Array<{id:string;price:number;adjustedPrice:number;matchScore:number;source?:string;sourceUrl?:string;retrievedAt?:string;adjustments:Record<string,number>}>;
  evidence:Array<{type:string;id:string;source?:string;sourceUrl?:string;retrievedAt?:string;value:number}>;
  conditionStates?:Array<{state:ValuationConditionState;indicatedValue:number;confidence:number;reviewRequired:boolean}>;
  conditionDeltas?:{repairRecovery:number|null;remainingValueGap:number|null;totalRestorationPotential:number|null;residualDiminishedValue:number|null};
  disclosure:string;
};

const methodology=[
  'Comparable vehicles are adjusted to the subject using configured mileage, option, equipment and depreciation policies.',
  'Selected comparables are averaged and may be blended with licensed guide sources using explicit weights.',
  'Taxes and fixed jurisdictional fees are applied only when configured.',
  'Confidence reflects comparable similarity, comparable count and provenance completeness.',
];

function basePacket(subject:ReportPacket['subject'],valuation:ValuationResult):ReportPacket {
  return {
    reportType:'fair_market_value',generatedAt:new Date().toISOString(),subject,
    summary:{indicatedValue:valuation.indicatedValue,confidence:valuation.confidence,reviewRequired:valuation.confidence<75},
    methodology,
    comparables:valuation.adjustedComparables.filter(c=>valuation.selectedComparableIds.includes(c.id)).map(c=>({id:c.id,price:c.price,adjustedPrice:c.adjustedPrice,matchScore:c.matchScore,source:c.source,sourceUrl:c.sourceUrl,retrievedAt:c.retrievedAt,adjustments:c.adjustments})),
    evidence:valuation.evidence,
    disclosure:'Analytical valuation output. Final appraisal conclusions require source verification, applicable jurisdiction review, and authorized release approval.'
  };
}

export function buildFairMarketValuePacket(subject:ReportPacket['subject'],valuation:ValuationResult):ReportPacket{
  return basePacket(subject,valuation);
}

export function buildAcvPacket(subject:ReportPacket['subject'],result:AcvResult):ReportPacket{
  const packet=basePacket(subject,result.valuation);
  return {
    ...packet,
    reportType:'acv',
    methodVersion:result.methodVersion,
    summary:{indicatedValue:result.acv,confidence:result.confidence,reviewRequired:result.reviewRequired,reviewReasons:result.reviewReasons},
    methodology:[...methodology,'Actual Cash Value applies documented subject-condition findings to the supported market-value indication. Condition changes require evidence and remain auditable.']
  };
}

export function buildDiminishedValuePacket(subject:ReportPacket['subject'],valuation:DiminishedValueResult):ReportPacket{
  const packet=basePacket(subject,valuation.preLoss);
  return {
    ...packet,
    reportType:'diminished_value',
    methodVersion:valuation.methodVersion,
    summary:{indicatedValue:valuation.diminishedValue,confidence:valuation.confidence,reviewRequired:valuation.reviewRequired,reviewReasons:valuation.reviewReasons},
    methodology:[...methodology,'Diminished value uses a market-supported pre-loss value and modeled and/or market-supported post-repair value. Formula references, when shown, are reference-only and do not determine the final conclusion.'],
    evidence:[...packet.evidence,...valuation.damageAdjustments.map((a,i)=>({type:'damage_adjustment',id:a.evidenceId||`damage-${i+1}`,source:a.source,value:a.amount}))]
  };
}


export function buildAcvConditionStatePacket(
  subject:ReportPacket['subject'],
  result:AcvAcrossConditionsResult,
):ReportPacket {
  const preferred = result.states.post_repair_as_is ?? result.states.corrected_operational ?? result.states.post_loss_pre_repair ?? result.states.pre_loss_undamaged;
  if (!preferred) throw new Error('condition_state_valuation_required');
  const packet = basePacket(subject, preferred.valuation);
  const conditionStates = (Object.entries(result.states) as Array<[ValuationConditionState, AcvResult | undefined]>)
    .filter((entry): entry is [ValuationConditionState, AcvResult] => Boolean(entry[1]))
    .map(([state, value]) => ({
      state,
      indicatedValue:value.acv,
      confidence:value.confidence,
      reviewRequired:value.reviewRequired,
    }));
  return {
    ...packet,
    reportType:'acv',
    methodVersion:result.methodVersion,
    summary:{
      indicatedValue:preferred.acv,
      confidence:result.confidence,
      reviewRequired:result.reviewRequired,
      reviewReasons:result.reviewReasons,
    },
    conditionStates,
    conditionDeltas:result.deltas,
    methodology:[
      ...methodology,
      'Actual Cash Value is calculated independently for each supported condition state rather than by adding repair invoices to a prior value.',
      'Pre-repair, current as-is, and corrected-operational values remain separate conclusions tied to their own effective dates, market evidence, and documented condition.',
      'Repair expenditures are evidence of work performed and are not presumed to increase market value dollar-for-dollar.',
    ],
  };
}
