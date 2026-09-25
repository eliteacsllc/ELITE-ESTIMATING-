export type ValuationJurisdictionRule = {
  id:string;
  jurisdiction:string;
  effectiveFrom:string;
  effectiveTo?:string;
  claimTypes:('first_party'|'third_party'|'appraisal'|'litigation_support')[];
  allowsDiminishedValue?:boolean;
  requiresLiabilityAcceptance?:boolean;
  taxesIncludedInAcv?:boolean;
  feesIncludedInAcv?:boolean;
  requiredDisclosures?:string[];
  sourceRefs:string[];
  reviewedBy?:string;
  reviewedAt?:string;
};

export type JurisdictionDecision = {
  ruleId:string;
  applicable:boolean;
  reviewRequired:boolean;
  reasons:string[];
  disclosures:string[];
};

export function evaluateJurisdiction(input:{
  rule:ValuationJurisdictionRule;
  lossDate:string;
  claimType:'first_party'|'third_party'|'appraisal'|'litigation_support';
  kind:'acv'|'diminished_value';
  liabilityAccepted?:boolean;
}):JurisdictionDecision {
  const loss=Date.parse(input.lossDate);
  const start=Date.parse(input.rule.effectiveFrom);
  const end=input.rule.effectiveTo?Date.parse(input.rule.effectiveTo):Number.POSITIVE_INFINITY;
  if(!Number.isFinite(loss)) throw new Error('jurisdiction_loss_date_invalid');
  if(!Number.isFinite(start)) throw new Error('jurisdiction_effective_from_invalid');
  const reasons:string[]=[];
  if(loss<start||loss>end) reasons.push('rule_not_effective_on_loss_date');
  if(!input.rule.claimTypes.includes(input.claimType)) reasons.push('claim_type_not_covered_by_rule');
  if(input.kind==='diminished_value'&&input.rule.allowsDiminishedValue===false) reasons.push('diminished_value_not_allowed_by_configured_rule');
  if(input.kind==='diminished_value'&&input.rule.requiresLiabilityAcceptance&&input.liabilityAccepted!==true) reasons.push('liability_acceptance_required');
  if(input.rule.sourceRefs.length===0) reasons.push('jurisdiction_source_reference_required');
  if(!input.rule.reviewedBy||!input.rule.reviewedAt) reasons.push('jurisdiction_rule_not_reviewed');
  return {
    ruleId:input.rule.id,
    applicable:reasons.filter(r=>r==='rule_not_effective_on_loss_date'||r==='claim_type_not_covered_by_rule'||r==='diminished_value_not_allowed_by_configured_rule').length===0,
    reviewRequired:reasons.length>0,
    reasons,
    disclosures:[...(input.rule.requiredDisclosures??[])],
  };
}
