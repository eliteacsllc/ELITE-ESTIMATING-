import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTOMOTIVE_MARKET_EVIDENCE_SCHEMA_VERSION,
  acceptMarketEvidence,
  normalizeMarketEvidence,
  type MarketEvidenceRecord,
} from "../index.js";

const base: MarketEvidenceRecord = {
  schemaVersion: AUTOMOTIVE_MARKET_EVIDENCE_SCHEMA_VERSION,
  id: "1",
  tenantId: "tenant-a",
  kind: "auction_result",
  provider: "authorized-market",
  sourceId: "sale-1",
  observedAt: "2026-09-19T00:00:00Z",
  amount: 9000,
  currency: "USD",
  licenseClass: "licensed",
  authorized: true,
  confidence: 0.8,
};

test("market evidence requires authorized source", () => {
  assert.equal(acceptMarketEvidence({ ...base, authorized: false }), false);
});

test("market evidence deduplicates provider source IDs within a tenant", () => {
  assert.equal(normalizeMarketEvidence([base, { ...base, id: "2" }]).length, 1);
  assert.equal(normalizeMarketEvidence([base, { ...base, id: "3", tenantId: "tenant-b" }]).length, 2);
});

test("market evidence rejects invalid timestamp and non-finite amount", () => {
  assert.equal(acceptMarketEvidence({ ...base, observedAt: "not-a-date" }), false);
  assert.equal(acceptMarketEvidence({ ...base, amount: Number.POSITIVE_INFINITY }), false);
});

test("market evidence rejects schema mismatch", () => {
  assert.equal(acceptMarketEvidence({ ...base, schemaVersion: "legacy" as typeof AUTOMOTIVE_MARKET_EVIDENCE_SCHEMA_VERSION }), false);
});
