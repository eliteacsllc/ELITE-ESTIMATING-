import type {ValuationResult} from './market-valuation.js';
import type {DiminishedValueResult} from './diminished-value.js';

export type ReportPacket={
  reportType:'fair_market_value'|'diminished_value';
  generatedAt:string;
  subject:{vin?:string;year?:number;make?:string;model?:string;trim?:string;mileage?:number};
  summary:{indicatedValue:number;confidence:number;reviewRequired:boolean};
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

export function buildFairMarketValuePacket(subject:ReportPacket['subject'],valuation:ValuationResult):ReportPacket{
  return {
    reportType:'fair_market_value',generatedAt:new Date().toISOString(),subject,
    summary:{indicatedValue:valuation.indicatedValue,confidence:valuation.confidence,reviewRequired:valuation.confidence<75},
    methodology,
    comparables:valuation.adjustedComparables.filter(c=>valuation.selectedComparableIds.includes(c.id)).map(c=>({id:c.id,price:c.price,adjustedPrice:c.adjustedPrice,matchScore:c.matchScore,source:c.source,sourceUrl:c.sourceUrl,retrievedAt:c.retrievedAt,adjustments:c.adjustments})),
    evidence:valuation.evidence,
    disclosure:'Preliminary analytical output. Final appraisal conclusions require authorized human review and source verification.'
  };
}

export function buildDiminishedValuePacket(subject:ReportPacket['subject'],valuation:DiminishedValueResult):ReportPacket{
  const packet=buildFairMarketValuePacket(subject,valuation.preLoss);
  return {
    ...packet,
    reportType:'diminished_value',
    summary:{indicatedValue:valuation.diminishedValue,confidence:valuation.confidence,reviewRequired:valuation.reviewRequired},
    methodology:[...methodology,'Diminished value compares the supported pre-loss indication with modeled and/or market-supported post-loss value, with documented damage adjustments.'],
    evidence:[...packet.evidence,...valuation.damageAdjustments.map((a,i)=>({type:'damage_adjustment',id:a.evidenceId||`damage-${i+1}`,source:a.source,value:a.amount}))]
  };
}
