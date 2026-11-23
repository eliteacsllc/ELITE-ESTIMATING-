import test from "node:test";
import assert from "node:assert/strict";
import { assertTenantSafeEstimatingBatch, classifyEstimatingWork, estimatingApprovalGates } from "./work-hub-estimating.js";

test("routes grounded estimate intake", () => {
  const result = classifyEstimatingWork({ tenantId: "t1", eventId: "e1", body: "new estimate", claimId: "c1", evidenceIds: ["photo1"], provenance: ["intake"], confidence: 0.9 });
  assert.equal(result.action, "intake_estimate");
  assert.equal(result.executionAuthority, false);
});

test("supplements and QA releases remain governed", () => {
  const supplement = classifyEstimatingWork({ tenantId: "t1", eventId: "e2", body: "supplement needed", jobId: "j1", evidenceIds: ["doc"], provenance: ["shop"], confidence: 0.9 });
  assert.equal(supplement.action, "review_supplement");
  assert.equal(supplement.requiresApproval, true);
  assert.ok(estimatingApprovalGates().includes("estimate_release"));
});

test("low confidence or missing evidence requests documentation", () => {
  const result = classifyEstimatingWork({ tenantId: "t1", eventId: "e3", body: "estimate", claimId: "c1", confidence: 0.5 });
  assert.equal(result.action, "request_documentation");
  assert.ok(result.missing.includes("evidence"));
});

test("sensitive disputes escalate to humans", () => {
  const result = classifyEstimatingWork({ tenantId: "t1", eventId: "e4", body: "attorney dispute", claimId: "c1", evidenceIds: ["x"], provenance: ["claim"], confidence: 0.9 });
  assert.equal(result.action, "human_review");
  assert.equal(result.priority, "critical");
});

test("cross-tenant batches fail closed", () => {
  assert.throws(() => assertTenantSafeEstimatingBatch([{ tenantId: "t2", eventId: "foreign" }], "t1"), /cross-tenant/);
});
