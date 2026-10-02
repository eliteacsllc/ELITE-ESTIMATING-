import type {Estimate} from "../domain/types.js";
import {auditEstimateIntelligence} from "./estimate-audit.js";
export function estimateGuidance(estimate:Estimate){
 const audit=auditEstimateIntelligence(estimate);
 const groups=new Map<string,number>();
 for(const f of audit.findings)groups.set(f.code,(groups.get(f.code)??0)+1);
 const actions=[...groups.entries()].map(([code,count])=>({code,count,priority:code.includes("safety")||code.includes("approval")?"critical":code.includes("missing")?"high":"normal"})).sort((a,b)=>({critical:3,high:2,normal:1}[b.priority]-({critical:3,high:2,normal:1}[a.priority]));
 return{estimateId:estimate.id,green:audit.green,actions,humanReleaseRequired:!audit.green||estimate.lines.some(l=>l.aiSuggested&&!l.humanApproved),summary:`${audit.findings.length} finding(s), ${actions.filter(a=>a.priority==="critical").length} critical action group(s)`};
}
