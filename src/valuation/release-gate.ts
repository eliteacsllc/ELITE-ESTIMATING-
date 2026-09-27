import type { AcvResult } from './acv-engine.js';
import type { DiminishedValueResult } from './diminished-value.js';
import type { JurisdictionDecision } from './jurisdiction.js';

export type ValuationReleaseDecision = {
  status:'blocked'|'human_review'|'eligible';
  reasons:string[];
  checks:{
    identity:boolean;
    evidence:boolean;
    confidence:boolean;
    jurisdiction:boolean;
    methodology:boolean;
  };
};

export function evaluateValuationRelease(input:{
  kind:'acv'|'diminished_value';
  subject:{vin?:string;year?:number;make?:string;model?:string;mileage?:number};
  result:AcvResult|DiminishedValueResult;
  jurisdiction?:JurisdictionDecision;
  methodologyVersion?:string;
  humanApprovalRequired?:boolean;
}):ValuationReleaseDecision {
  const reasons:string[]=[];
  const identity=Boolean((input.subject.vin&&input.subject.vin.length===17)||(input.subject.year&&input.subject.make&&input.subject.model));
  if(!identity) reasons.push('subject_identity_incomplete');

  const acv=input.kind==='acv'?(input.result as AcvResult):undefined;
  const dv=input.kind==='diminished_value'?(input.result as DiminishedValueResult):undefined;
  const market=acv?.valuation??dv?.preLoss;
  const evidence=Boolean(market&&market.selectedComparableIds.length>=3&&market.evidence.length>=3);
  if(!evidence) reasons.push('minimum_market_evidence_not_met');

  const confidence=(acv?.confidence??dv?.confidence??0)>=75;
  if(!confidence) reasons.push('confidence_below_release_threshold');

  const jurisdiction=input.jurisdiction?(!input.jurisdiction.reviewRequired&&input.jurisdiction.applicable):false;
  if(!input.jurisdiction) reasons.push('jurisdiction_rule_missing');
  else if(!jurisdiction) reasons.push(...input.jurisdiction.reasons.map(r=>`jurisdiction:${r}`));

  const methodology=Boolean(input.methodologyVersion?.trim());
  if(!methodology) reasons.push('methodology_version_missing');

  if(acv?.reviewRequired) reasons.push(...acv.reviewReasons.map(r=>`acv:${r}`));
  if(dv?.reviewRequired) reasons.push('dv:calculation_requires_review');

  const hardBlock=reasons.some(r=>
    r==='subject_identity_incomplete'||
    r==='minimum_market_evidence_not_met'||
    r==='jurisdiction_rule_missing'||
    r.startsWith('jurisdiction:rule_not_effective')||
    r.startsWith('jurisdiction:claim_type_not_covered')||
    r.startsWith('jurisdiction:diminished_value_not_allowed')
  );
  const requiresHuman=input.humanApprovalRequired!==false || reasons.length>0;
  return {
    status:hardBlock?'blocked':requiresHuman?'human_review':'eligible',
    reasons:[...new Set(reasons)],
    checks:{identity,evidence,confidence,jurisdiction,methodology},
  };
}
