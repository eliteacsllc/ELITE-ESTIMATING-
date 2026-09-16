import './production-bindings-smoke.mjs';
import './elite-compute-fabric-smoke.mjs';
import './compute-smoke.mjs';
import fs from 'node:fs';
import { eliteRuntime, releaseGate, createPortfolioContext, portfolioHeaders, createPortfolioEvent, assertTenant } from './runtime.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
const context=createPortfolioContext({tenantId:'smoke-tenant',actorId:'smoke-actor',traceId:'trace-smoke',requestId:'request-smoke'});
const headers=portfolioHeaders(context);
const event=createPortfolioEvent({type:'elite.estimate.smoke.v1',context,data:{ok:true}});
let crossTenantBlocked=false;try{assertTenant(context,'other-tenant')}catch{crossTenantBlocked=true}
const checks={version:manifest.version==='1.0',repo:Boolean(manifest.repo),truthStages:['predicted','verified','observed'].every(x=>manifest.truthStages.includes(x)),capabilities:Array.isArray(manifest.capabilities)&&manifest.capabilities.length>0,capabilitiesKnown:manifest.capabilities.every(x=>eliteRuntime.capabilities.includes(x)),providerNeutral:manifest.requirements?.providerNeutral===true,provenance:manifest.requirements?.provenance===true,exactHeadVerification:manifest.requirements?.exactHeadVerification===true,portfolioSpec:eliteRuntime.portfolioEventSpec==='elite.event.v1',tenantHeader:headers['x-elite-tenant']==='smoke-tenant',actorHeader:headers['x-elite-actor']==='smoke-actor',traceHeader:headers['x-elite-trace']==='trace-smoke',requestHeader:headers['x-elite-request']==='request-smoke',eventContext:event.context.traceId==='trace-smoke',crossTenantBlocked};
const result=releaseGate(checks);if(!result.passed){console.error(JSON.stringify({status:'failed',checks,...result},null,2));process.exit(1)}console.log(JSON.stringify({status:'ok',repo:manifest.repo,domain:manifest.domain,capabilities:manifest.capabilities,checks},null,2));
