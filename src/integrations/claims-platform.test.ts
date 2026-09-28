import test from "node:test";
import assert from "node:assert/strict";
import {buildEstimateQaHandoff,validateClaimEstimateSnapshot} from "./claims-platform.js";

const snapshot={
  estimateId:"est1",revision:1,claimId:"c1",activityId:"a1",tenantId:"t1",
  snapshotRef:"sha256:abc",submittedBy:"u1",submittedAt:"2026-09-28T00:00:00Z",
  humanApproved:false,
  valuationEvidence:[{id:"ev1",kind:"comparable" as const,provider:"licensed-provider",retrievedAt:"2026-09-28T00:00:00Z",licenseClass:"licensed" as const,confidence:0.9}]
};

test("validates valuation provenance and immutable snapshot handoff",()=>{
  assert.equal(validateClaimEstimateSnapshot(snapshot).snapshotRef,"sha256:abc");
  const event=buildEstimateQaHandoff(snapshot);
  assert.equal(event.eventType,"estimate.created");
  assert.equal(event.data.revision,1);
});

test("rejects missing provenance",()=>{
  assert.throws(()=>validateClaimEstimateSnapshot({...snapshot,valuationEvidence:[{...snapshot.valuationEvidence[0],provider:""}]}),/provenance/);
});
