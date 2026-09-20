import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("canonical SDK integration adoption passes", () => {
  const output = execFileSync(process.execPath, ["scripts/verify-sdk-integration-contract.mjs"], { encoding: "utf8", cwd: process.cwd() });
  const proof = JSON.parse(output) as { schemaVersion:string; product:string; passed:boolean; blockers:string[]; pathIds:string[] };
  assert.equal(proof.schemaVersion, "elite.sdk-integration-adoption-proof-v1");
  assert.equal(proof.product, "elite-estimating");
  assert.equal(proof.passed, true);
  assert.deepEqual(proof.blockers, []);
  assert.deepEqual(proof.pathIds, ["estimate-recommendation-handoff"]);
});
