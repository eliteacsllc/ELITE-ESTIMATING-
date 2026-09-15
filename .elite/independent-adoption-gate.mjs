import fs from 'node:fs';
const path = process.env.ELITE_ADOPTION_EVIDENCE || '.elite/governance-adoption-evidence.json';
const requiredControls = ['tenantIsolation','evidenceProvenance','humanApproval','auditLogging','rollback','soc2Evidence','shadowAiGovernance'];
function fail(reason){ console.error(`ELITE_ADOPTION_BLOCKED: ${reason}`); process.exit(1); }
if(!fs.existsSync(path)) fail('governance evidence file missing');
let evidence; try{ evidence=JSON.parse(fs.readFileSync(path,'utf8')); }catch{ fail('governance evidence is not valid JSON'); }
if(evidence.schema!=='elite.independent-adoption-evidence.v1') fail('unsupported evidence schema');
if(!evidence.repository||!evidence.commitSha||!evidence.tenantId) fail('repository, commitSha, and tenantId are required');
if(process.env.GITHUB_SHA&&evidence.commitSha!==process.env.GITHUB_SHA) fail('evidence is not bound to exact head');
for(const control of requiredControls) if(evidence.controls?.[control]!==true) fail(`missing control evidence: ${control}`);
if(evidence.vendorDecision?.adoptionState!=='approved') fail('vendor adoption is not approved');
if(evidence.vendorDecision?.tenantId!==evidence.tenantId) fail('cross-tenant vendor decision rejected');
if(!evidence.vendorDecision?.evidenceFingerprint) fail('vendor evidence fingerprint missing');
if(evidence.shadowAiDecision?.decision!=='allowed'||evidence.shadowAiDecision?.shadowAi===true) fail('shadow AI policy not satisfied');
if(evidence.highRiskExecution===true&&evidence.humanApproval?.state!=='approved') fail('high-risk execution requires human approval');
console.log(JSON.stringify({schema:'elite.independent-adoption-gate.v1',repository:evidence.repository,commitSha:evidence.commitSha,pass:true}));
