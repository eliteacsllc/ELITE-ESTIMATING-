export type EstimatingTrustLevel = 'recommend_only'|'sandbox'|'bounded_write'|'high_trust'|'production_autonomous';
export interface EstimatingTrustSignal { score:number; verified:boolean; blocked:boolean; level:EstimatingTrustLevel; evidenceId?:string; }
export function gateEstimatingAction(input:{trust?:EstimatingTrustSignal; safetyCritical?:boolean; humanApproved?:boolean}) {
  const t=input.trust;
  if(!t||!t.verified||t.blocked||!Number.isFinite(t.score)||t.score<0||t.score>1)
    return {allowed:false,requiresHumanApproval:true,reason:'trust_invalid_or_blocked'};
  if(input.safetyCritical && !input.humanApproved)
    return {allowed:false,requiresHumanApproval:true,reason:'safety_critical_human_approval_required'};
  const ceiling=t.score>=.95?'production_autonomous':t.score>=.88?'high_trust':t.score>=.75?'bounded_write':t.score>=.60?'sandbox':'recommend_only';
  if(ceiling==='recommend_only'||ceiling==='sandbox')
    return {allowed:false,requiresHumanApproval:true,reason:'trust_below_write_threshold'};
  return {allowed:true,requiresHumanApproval:false,reason:'trust_and_domain_controls_satisfied'};
}
