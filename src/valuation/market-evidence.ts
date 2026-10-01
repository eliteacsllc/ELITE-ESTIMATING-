export const AUTOMOTIVE_MARKET_EVIDENCE_SCHEMA_VERSION = "elite.automotive-market-evidence.v1" as const;

export type MarketEvidenceKind =
  | "dealer_quote"
  | "retail_comparable"
  | "wholesale_comparable"
  | "auction_result"
  | "salvage_bid"
  | "guide_value";

const MARKET_EVIDENCE_KINDS = new Set<MarketEvidenceKind>(["dealer_quote","retail_comparable","wholesale_comparable","auction_result","salvage_bid","guide_value"]);

export type MarketEvidenceLicenseClass =
  | "owned"
  | "licensed"
  | "public"
  | "customer_provided"
  | "internal";

const MARKET_EVIDENCE_LICENSE_CLASSES = new Set<MarketEvidenceLicenseClass>(["owned","licensed","public","customer_provided","internal"]);

export interface MarketEvidenceRecord {
  schemaVersion: typeof AUTOMOTIVE_MARKET_EVIDENCE_SCHEMA_VERSION;
  id: string;
  tenantId: string;
  kind: MarketEvidenceKind;
  provider: string;
  sourceId: string;
  observedAt: string;
  retrievedAt?: string;
  amount: number;
  currency: string;
  region?: string;
  mileage?: number;
  condition?: string;
  licenseClass: MarketEvidenceLicenseClass;
  authorized: boolean;
  confidence: number;
  evidenceRef?: string;
}

export function acceptMarketEvidence(record: MarketEvidenceRecord): boolean {
  const observedAtMs = Date.parse(record.observedAt);
  return Boolean(
    record.schemaVersion === AUTOMOTIVE_MARKET_EVIDENCE_SCHEMA_VERSION &&
    record.id &&
    record.tenantId &&
    MARKET_EVIDENCE_KINDS.has(record.kind) &&
    MARKET_EVIDENCE_LICENSE_CLASSES.has(record.licenseClass) &&
    record.provider &&
    record.sourceId &&
    Number.isFinite(observedAtMs) &&
    Number.isFinite(record.amount) &&
    record.amount >= 0 &&
    /^[A-Z]{3}$/.test(record.currency) &&
    record.authorized &&
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
      const key = `${record.tenantId}:${record.provider.trim().toLowerCase()}:${record.sourceId.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
