import './production-bindings-smoke.mjs';
import './elite-compute-fabric-smoke.mjs';
import './compute-smoke.mjs';
import fs from 'node:fs';
import { eliteRuntime, releaseGate } from './runtime.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
const checks={version:manifest.version==='1.0',repo:Boolean(manifest.repo),truthStages:['predicted','verified','observed'].every(x=>manifest.truthStages.includes(x)),capabilities:Array.isArray(manifest.capabilities)&&manifest.capabilities.length>0,capabilitiesKnown:manifest.capabilities.every(x=>eliteRuntime.capabilities.includes(x)),providerNeutral:manifest.requirements?.providerNeutral===true,provenance:manifest.requirements?.provenance===true,exactHeadVerification:manifest.requirements?.exactHeadVerification===true};
const result=releaseGate(checks);if(!result.passed){console.error(JSON.stringify({status:'failed',checks,...result},null,2));process.exit(1)}console.log(JSON.stringify({status:'ok',repo:manifest.repo,domain:manifest.domain,capabilities:manifest.capabilities,checks},null,2));
