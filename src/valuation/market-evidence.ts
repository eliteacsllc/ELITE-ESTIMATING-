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
  return Boolean(
    record.id &&
    record.provider &&
    record.sourceId &&
    record.amount >= 0 &&
    record.currency &&
    record.licensedOrAuthorized &&
    record.confidence >= 0 &&
    record.confidence <= 1,
  );
}

export function normalizeMarketEvidence(records: MarketEvidenceRecord[]): MarketEvidenceRecord[] {
  const seen = new Set<string>();
  return records
    .filter(acceptMarketEvidence)
    .filter((record) => {
      const key = `${record.provider}:${record.sourceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
