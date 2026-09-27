import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function fail(message){ console.error(`FAIL: ${message}`); process.exit(1); }
const git=spawnSync("git",["rev-parse","HEAD"],{encoding:"utf8",shell:process.platform==="win32"});
if(git.status!==0) fail("unable to resolve git HEAD");
const sha=String(git.stdout||"").trim();
const path=process.env.ELITE_RELEASE_AUTHORIZATION_PATH||".elite/release-authorization.json";
let record;
try{ record=JSON.parse(readFileSync(path,"utf8")); }catch{ fail(`release authorization record missing or invalid: ${path}`); }
if(record.schemaVersion!=="elite.release.authorization.v1") fail("unsupported release authorization schema");
if(record.releaseSha!==sha) fail(`authorization SHA mismatch: expected ${sha}, got ${record.releaseSha||"missing"}`);
if(!["LIMITED_PILOT","GENERAL_RELEASE"].includes(record.decision)) fail("release decision must be LIMITED_PILOT or GENERAL_RELEASE");
if(!Array.isArray(record.scope?.activities)||record.scope.activities.length===0) fail("authorized activity scope is required");
if(!Array.isArray(record.scope?.jurisdictions)||record.scope.jurisdictions.length===0) fail("authorized jurisdiction scope is required");
if(!Array.isArray(record.evidence)||record.evidence.length===0) fail("release evidence is required");
if(Array.isArray(record.blockers)&&record.blockers.length>0) fail("release authorization contains unresolved blockers");
const roles=["product","security","operations","legal"];
if(record.scope?.moneyMovement===true) roles.push("finance");
const approvals=new Map((Array.isArray(record.approvals)?record.approvals:[]).map(a=>[a?.role,a]));
for(const role of roles){
  const a=approvals.get(role);
  if(!a||a.approved!==true||!a.approver||!a.approvedAt||!a.evidence) fail(`missing evidence-backed ${role} approval`);
}
if(!record.expiresAt||Number.isNaN(Date.parse(record.expiresAt))||Date.parse(record.expiresAt)<=Date.now()) fail("release authorization missing or expired");
console.log(JSON.stringify({authorized:true,releaseSha:sha,decision:record.decision,scope:record.scope,expiresAt:record.expiresAt},null,2));
