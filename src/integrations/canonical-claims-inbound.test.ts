import test from "node:test";
import assert from "node:assert/strict";
import {canonicalEstimateResult,validateCanonicalClaimsEstimateRequest} from "./canonical-claims-inbound.js";

const req=()=>({tenantId:"t1",claimId:"c1",correlationId:"corr",actor:"claims",target:"elite-estimating-os" as const,action:"estimate.requested",schemaVersion:"1.0.0",idempotencyKey:"idem",createdAt:new Date().toISOString(),payload:{asset:{domain:"automotive"}}});

test("validates canonical request",()=>assert.deepEqual(validateCanonicalClaimsEstimateRequest(req()),[]));
test("requires asset",()=>assert.ok(validateCanonicalClaimsEstimateRequest({...req(),payload:{}}).includes("asset_required")));
test("builds canonical result",()=>{
 const r=canonicalEstimateResult(req(),"est1",false,["ev1"]);
 assert.equal(r.resultRef,"elite-estimating:estimate:est1");
 assert.equal(r.correlationId,"corr");
 assert.deepEqual(r.evidenceRefs,["ev1"]);
});
