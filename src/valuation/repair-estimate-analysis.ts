export type RepairEstimateLine = {
  category?: 'body' | 'paint' | 'frame' | 'mechanical' | 'electrical' | 'glass' | 'other';
  description: string;
  laborHours?: number;
  laborAmount?: number;
  partsAmount?: number;
  otherAmount?: number;
  operation?: 'repair' | 'replace' | 'remove_install' | 'inspect' | 'other';
  structural?: boolean;
  safetySystem?: boolean;
};

export type RepairEstimateAnalysis = {
  totals: { labor: number; parts: number; other: number; total: number };
  structuralLineCount: number;
  safetySystemLineCount: number;
  replacedPanelCount: number;
  severity: 'minor' | 'moderate' | 'major' | 'severe';
  marketDamageAdjustmentSuggestion: number;
  confidence: number;
  reviewRequired: boolean;
  reasons: string[];
};

const round=(n:number)=>Math.round((Number.isFinite(n)?n:0)*100)/100;

export function analyzeRepairEstimate(input:{lines:RepairEstimateLine[]; vehiclePreLossValue?:number}):RepairEstimateAnalysis{
  const lines=Array.isArray(input.lines)?input.lines:[];
  if(!lines.length) throw new Error('repair_estimate_lines_required');
  const labor=round(lines.reduce((s,l)=>s+Math.max(0,Number(l.laborAmount)||0),0));
  const parts=round(lines.reduce((s,l)=>s+Math.max(0,Number(l.partsAmount)||0),0));
  const other=round(lines.reduce((s,l)=>s+Math.max(0,Number(l.otherAmount)||0),0));
  const total=round(labor+parts+other);
  const structuralLineCount=lines.filter(l=>l.structural||l.category==='frame').length;
  const safetySystemLineCount=lines.filter(l=>l.safetySystem||/airbag|adas|radar|camera|seat belt|restraint/i.test(l.description||'')).length;
  const replacedPanelCount=lines.filter(l=>l.operation==='replace'&&/panel|quarter|door|hood|roof|rail|apron|pillar/i.test(l.description||'')).length;
  const preLoss=Math.max(0,Number(input.vehiclePreLossValue)||0);
  const ratio=preLoss>0?total/preLoss:0;
  let severity:'minor'|'moderate'|'major'|'severe'='minor';
  if(structuralLineCount>0||ratio>=0.5) severity='severe';
  else if(replacedPanelCount>=2||safetySystemLineCount>=2||ratio>=0.3) severity='major';
  else if(replacedPanelCount>=1||ratio>=0.12) severity='moderate';
  const factors={minor:0.02,moderate:0.05,major:0.09,severe:0.14} as const;
  const marketDamageAdjustmentSuggestion=round(preLoss>0?preLoss*factors[severity]:0);
  const completeness=[labor>0||parts>0,preLoss>0,lines.some(l=>Boolean(l.category)),lines.some(l=>Boolean(l.operation))].filter(Boolean).length/4;
  const confidence=round(Math.min(100,55+completeness*35+(structuralLineCount||replacedPanelCount?10:0)));
  const reasons:string[]=[];
  if(structuralLineCount) reasons.push(`${structuralLineCount} structural/frame line(s)`);
  if(safetySystemLineCount) reasons.push(`${safetySystemLineCount} safety-system line(s)`);
  if(replacedPanelCount) reasons.push(`${replacedPanelCount} replaced exterior/structural panel(s)`);
  if(preLoss<=0) reasons.push('pre-loss value missing; market damage adjustment cannot be calculated');
  return {totals:{labor,parts,other,total},structuralLineCount,safetySystemLineCount,replacedPanelCount,severity,marketDamageAdjustmentSuggestion,confidence,reviewRequired:confidence<80||preLoss<=0,reasons};
}
