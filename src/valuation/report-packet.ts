import type {ValuationResult} from './market-valuation.js';
import type {DiminishedValueResult} from './diminished-value.js';
import type {AcvResult} from './acv-engine.js';

export type ReportPacket={
  reportType:'fair_market_value'|'acv'|'diminished_value';
  generatedAt:string;
  methodVersion?:string;
  subject:{vin?:string;year?:number;make?:string;model?:string;trim?:string;mileage?:number};
  summary:{indicatedValue:number;confidence:number;reviewRequired:boolean;reviewReasons?:string[]};
  methodology:string[];
  comparables:Array<{id:string;price:number;adjustedPrice:number;matchScore:number;source?:string;sourceUrl?:string;retrievedAt?:string;adjustments:Record<string,number>}>;
  evidence:Array<{type:string;id:string;source?:string;sourceUrl?:string;retrievedAt?:string;value:number}>;
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
