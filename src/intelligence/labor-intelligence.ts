import type { Estimate, EstimateLine, EstimateOperation } from '../domain/types.js';

export type LaborFindingDisposition = 'required'|'likely_required'|'contextual'|'unsupported'|'already_included'|'duplicate'|'verify_manually';
export type LaborEvidenceNeed = 'damage_photo'|'teardown_photo'|'oem_procedure'|'scan_report'|'calibration_record'|'invoice'|'technician_note'|'other';

export type LaborDependencyRule = {
  id: string;
  trigger: { operation?: EstimateOperation; componentIncludes?: string[]; categoryIncludes?: string[] };
  suggested: { category: string; component: string; operation: EstimateOperation; laborHours?: number };
  disposition: Exclude<LaborFindingDisposition,'already_included'|'duplicate'>;
  rationale: string;
  evidenceNeeds?: LaborEvidenceNeed[];
  authoritativeRefs?: string[];
  safetyCritical?: boolean;
};

export type LaborIntelligenceFinding = {
  ruleId: string;
  disposition: LaborFindingDisposition;
  triggerLineId: string;
  matchedLineId?: string;
  suggestedLine: Omit<EstimateLine,'id'|'total'|'humanApproved'|'provenance'>;
  rationale: string;
  evidenceNeeds: LaborEvidenceNeed[];
  authoritativeRefs: string[];
  confidence: number;
  humanReviewRequired: true;
};

function norm(v:string|undefined){ return String(v??'').trim().toLowerCase(); }
function includesAny(value:string, needles:string[]|undefined){ return !needles?.length || needles.some(n=>norm(value).includes(norm(n))); }

function matchesTrigger(line:EstimateLine, rule:LaborDependencyRule){
  return (!rule.trigger.operation || line.operation===rule.trigger.operation)
    && includesAny(line.component, rule.trigger.componentIncludes)
    && includesAny(line.category, rule.trigger.categoryIncludes);
}

function equivalent(line:EstimateLine, rule:LaborDependencyRule){
  return norm(line.category)===norm(rule.suggested.category)
    && norm(line.component)===norm(rule.suggested.component)
    && line.operation===rule.suggested.operation;
}

export function analyzeLaborDependencies(estimate:Estimate, rules:LaborDependencyRule[]):LaborIntelligenceFinding[]{
  const findings:LaborIntelligenceFinding[]=[];
  for(const trigger of estimate.lines){
    for(const rule of rules){
      if(!matchesTrigger(trigger,rule)) continue;
      const matches=estimate.lines.filter(line=>equivalent(line,rule));
      const disposition:LaborFindingDisposition = matches.length>1 ? 'duplicate' : matches.length===1 ? 'already_included' : rule.disposition;
      const confidence = disposition==='already_included' ? 1 : disposition==='duplicate' ? 0.98 : rule.authoritativeRefs?.length ? 0.9 : 0.72;
      findings.push({
        ruleId:rule.id,
        disposition,
        triggerLineId:trigger.id,
        ...(matches[0]?{matchedLineId:matches[0].id}:{}),
        suggestedLine:{
          category:rule.suggested.category,
          component:rule.suggested.component,
          operation:rule.suggested.operation,
          quantity:1,
          ...(rule.suggested.laborHours!=null?{laborHours:rule.suggested.laborHours}:{}),
          ...(rule.safetyCritical?{safetyCritical:true}:{}),
          aiSuggested:true,
          aiConfidence:confidence,
          procedureRefs:rule.authoritativeRefs??[],
        },
        rationale:rule.rationale,
        evidenceNeeds:[...new Set(rule.evidenceNeeds??[])],
        authoritativeRefs:[...new Set(rule.authoritativeRefs??[])],
        confidence,
        humanReviewRequired:true
      });
    }
  }
  return findings;
}

export function actionableLaborFindings(findings:LaborIntelligenceFinding[]){
  return findings.filter(f=>['required','likely_required','contextual','verify_manually'].includes(f.disposition));
}

export function supplementNarrative(finding:LaborIntelligenceFinding){
  const evidence = finding.evidenceNeeds.length ? ` Evidence needed: ${finding.evidenceNeeds.join(', ')}.` : '';
  const refs = finding.authoritativeRefs.length ? ` Verify against: ${finding.authoritativeRefs.join(', ')}.` : '';
  return `${finding.rationale} Human verification required before supplement submission.${evidence}${refs}`;
}
