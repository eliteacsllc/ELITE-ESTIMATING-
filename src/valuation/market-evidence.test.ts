import test from "node:test";
import assert from "node:assert/strict";
import { acceptMarketEvidence, normalizeMarketEvidence } from "../index.js";

test("market evidence requires authorized source", () => {
  assert.equal(acceptMarketEvidence({
    id:"1", kind:"wholesale_comparable", provider:"market",
    sourceId:"lot-1", observedAt:"2026-09-19T00:00:00Z",
    amount:10000, currency:"USD", licensedOrAuthorized:false, confidence:0.9
  }), false);
});

test("market evidence deduplicates provider source IDs", () => {
  const base={kind:"auction_result",provider:"authorized-market",sourceId:"sale-1",observedAt:"2026-09-19T00:00:00Z",amount:9000,currency:"USD",licensedOrAuthorized:true,confidence:0.8};
  assert.equal(normalizeMarketEvidence([{...base,id:"1"},{...base,id:"2"}]).length,1);
});
