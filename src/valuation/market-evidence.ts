export type MarketEvidenceKind =
  | "dealer_quote"
  | "retail_comparable"
  | "wholesale_comparable"
  | "auction_result"
  | "salvage_bid"
  | "guide_value";

export interface MarketEvidenceRecord {
  id: string;
  kind: MarketEvidenceKind;
  provider: string;
  sourceId: string;
  observedAt: string;
  amount: number;
  currency: string;
  region?: string;
  mileage?: number;
  condition?: string;
  licensedOrAuthorized: boolean;
  confidence: number;
}

export function acceptMarketEvidence(record: MarketEvidenceRecord): boolean {
  const observedAtMs = Date.parse(record.observedAt);
  return Boolean(
    record.id &&
    record.provider &&
    record.sourceId &&
    Number.isFinite(observedAtMs) &&
    Number.isFinite(record.amount) &&
    record.amount >= 0 &&
    record.currency &&
    record.licensedOrAuthorized &&
    Number.isFinite(record.confidence) &&
    record.confidence >= 0 &&
    record.confidence <= 1 &&
    (record.mileage === undefined || (Number.isFinite(record.mileage) && record.mileage >= 0)),
  );
}

export function normalizeMarketEvidence(records: MarketEvidenceRecord[]): MarketEvidenceRecord[] {
  const seen = new Set<string>();
  return records
    .filter(acceptMarketEvidence)
    .filter((record) => {
      const key = `${record.provider.trim().toLowerCase()}:${record.sourceId.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
