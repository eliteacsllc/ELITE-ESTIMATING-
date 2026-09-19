import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptMarketEvidence,
  normalizeMarketEvidence,
  type MarketEvidenceRecord,
} from "../index.js";

test("market evidence requires authorized source", () => {
  assert.equal(acceptMarketEvidence({
    id: "1",
    kind: "wholesale_comparable",
    provider: "market",
    sourceId: "lot-1",
    observedAt: "2026-09-19T00:00:00Z",
    amount: 10000,
    currency: "USD",
    licensedOrAuthorized: false,
    confidence: 0.9,
  }), false);
});

test("market evidence deduplicates provider source IDs", () => {
  const base: Omit<MarketEvidenceRecord, "id"> = {
    kind: "auction_result",
    provider: "authorized-market",
    sourceId: "sale-1",
    observedAt: "2026-09-19T00:00:00Z",
    amount: 9000,
    currency: "USD",
    licensedOrAuthorized: true,
    confidence: 0.8,
  };
  assert.equal(normalizeMarketEvidence([{ ...base, id: "1" }, { ...base, id: "2" }]).length, 1);
});

test("market evidence rejects invalid timestamp and non-finite amount", () => {
  const base: MarketEvidenceRecord = {
    id: "1",
    kind: "auction_result",
    provider: "authorized-market",
    sourceId: "sale-2",
    observedAt: "not-a-date",
    amount: 9000,
    currency: "USD",
    licensedOrAuthorized: true,
    confidence: 0.8,
  };
  assert.equal(acceptMarketEvidence(base), false);
  assert.equal(acceptMarketEvidence({ ...base, observedAt: "2026-09-19T00:00:00Z", amount: Number.POSITIVE_INFINITY }), false);
});
