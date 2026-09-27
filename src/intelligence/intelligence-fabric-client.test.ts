import test from "node:test";
import assert from "node:assert/strict";
import { IntelligenceFabricClient } from "./intelligence-fabric-client.js";

test("estimate release is delegated to fabric preflight contract", async () => {
  let body: any;
  const client = new IntelligenceFabricClient({
    baseUrl: "https://blackbox.example",
    apiKey: "secret",
    tenantId: "tenant-a",
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ allowed:true, supported:true, requiresHumanApproval:true, reasons:[] }), { status:200, headers:{"content-type":"application/json"} });
    },
  });
  const result = await client.preflight({ requestId:"r1", subjectId:"estimate-1", domain:"estimating", capability:"estimate.release", actorId:"estimator-1", input:{} });
  assert.equal(body.capability, "estimate.release");
  assert.equal(result.requiresHumanApproval, true);
});
