import fs from "node:fs";
import path from "node:path";

const file=path.resolve(".elite/unified-work-hub.json");
const hub=JSON.parse(fs.readFileSync(file,"utf8"));
const fail=(message)=>{throw new Error("workhub_release_blocked: "+message);};
if(hub.schemaVersion!=="elite.unified-work-hub.v1") fail("unsupported schemaVersion");
for(const key of ["product","role","status"]) if(!hub[key]) fail("missing "+key);
if(hub.status!=="adopted") fail("status must be adopted");
if(!Array.isArray(hub.correlation)||hub.correlation.length<2) fail("correlation must define stable cross-repo identifiers");
if(!hub.routes||Object.keys(hub.routes).length<1) fail("at least one workflow route is required");
if(!Array.isArray(hub.approvalGates)||hub.approvalGates.length<1) fail("approval gates are required");
const caps=new Set(hub.requiredCapabilities||[]);
for(const required of ["tenant-isolation","audit","idempotency"]) if(!caps.has(required)) fail("missing required capability "+required);
for(const [event,target] of Object.entries(hub.routes)){
 if(!String(event).trim()||!String(target).trim()) fail("empty route");
}
console.log(JSON.stringify({ok:true,product:hub.product,routes:Object.keys(hub.routes).length,approvalGates:hub.approvalGates.length,capabilities:caps.size}));
