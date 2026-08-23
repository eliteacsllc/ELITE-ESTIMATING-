import type { Money, SourceProvenance } from '../domain/types.js';

export type PriceObservation = {
  price: Money;
  provenance: SourceProvenance;
  observedAt: string;
  sampleSize?: number;
};

export type NormalizedPrice = {
  price: Money;
  low: Money;
  high: Money;
  confidence: number;
  sources: SourceProvenance[];
  observationCount: number;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index]!;
}

export function normalizePrices(observations: PriceObservation[]): NormalizedPrice {
  if (observations.length === 0) throw new Error('pricing_observations_required');
  const currencies = new Set(observations.map((item) => item.price.currency));
  if (currencies.size !== 1) throw new Error('pricing_currency_mismatch');
  const currency = observations[0]!.price.currency;
  const raw = observations.map((item) => item.price.amountMinor);
  const q1 = percentile(raw, 0.25);
  const q3 = percentile(raw, 0.75);
  const iqr = Math.max(1, q3 - q1);
  const filtered = observations.filter((item) => item.price.amountMinor >= q1 - 1.5 * iqr && item.price.amountMinor <= q3 + 1.5 * iqr);
  const usable = filtered.length > 0 ? filtered : observations;
  const values = usable.map((item) => item.price.amountMinor);
  const diversity = new Set(usable.map((item) => item.provenance.provider)).size;
  const confidence = Math.min(0.99, 0.45 + Math.min(0.3, usable.length * 0.05) + Math.min(0.24, diversity * 0.06));
  return {
    price: { amountMinor: median(values), currency },
    low: { amountMinor: percentile(values, 0.1), currency },
    high: { amountMinor: percentile(values, 0.9), currency },
    confidence: Number(confidence.toFixed(2)),
    sources: usable.map((item) => item.provenance),
    observationCount: usable.length,
  };
}
