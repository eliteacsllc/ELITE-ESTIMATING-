export type MoneySource = {
  name: string;
  value: number;
  weight?: number;
  sourceUrl?: string;
  retrievedAt?: string;
  licenseRef?: string;
  evidenceHash?: string;
};

export type ComparableVehicle = {
  id: string;
  price: number;
  mileage?: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  options?: string[];
  equipment?: string[];
  distanceMiles?: number;
  sold?: boolean;
  sellerName?: string;
  listingStatus?: string;
  source?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  sourceEvidenceHash?: string;
  sourceSnapshotKey?: string;
  sourceSnapshotMimeType?: string;
};

export type SubjectVehicle = {
  mileage?: number;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  options?: string[];
  equipment?: string[];
};

export type AdjustmentPolicy = {
  mileageRatePerMile?: number;
  optionValues?: Record<string, number>;
  equipmentValues?: Record<string, number>;
  depreciationPercent?: number;
  taxPercent?: number;
  fixedFees?: number;
};

export type AdjustedComparable = ComparableVehicle & {
  adjustments: {
    mileage: number;
    options: number;
    equipment: number;
    depreciation: number;
  };
  adjustedPrice: number;
  matchScore: number;
};

export type ValuationResult = {
  adjustedComparables: AdjustedComparable[];
  selectedComparableIds: string[];
  comparableAverage: number;
  weightedBookAverage: number | null;
  preTaxValue: number;
  tax: number;
  fixedFees: number;
  indicatedValue: number;
  confidence: number;
  evidence: Array<{
    type: 'comparable' | 'book_source';
    id: string;
    source?: string;
    sourceUrl?: string;
    retrievedAt?: string;
    value: number;
    evidenceHash?: string;
    snapshotKey?: string;
    snapshotMimeType?: string;
    licenseRef?: string;
  }>;
};

const round = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const norm = (s?: string) => String(s ?? '').trim().toLowerCase();
const setOf = (v?: string[]) => new Set((v ?? []).map(norm).filter(Boolean));

function scoreComparable(subject: SubjectVehicle, comp: ComparableVehicle): number {
  let score = 100;
  if (subject.year && comp.year) score -= Math.min(25, Math.abs(subject.year - comp.year) * 8);
  if (subject.make && comp.make && norm(subject.make) !== norm(comp.make)) score -= 35;
  if (subject.model && comp.model && norm(subject.model) !== norm(comp.model)) score -= 30;
  if (subject.trim && comp.trim && norm(subject.trim) !== norm(comp.trim)) score -= 12;
  if (typeof comp.distanceMiles === 'number') score -= Math.min(12, comp.distanceMiles / 50);
  if (comp.sold) score += 3;
  return round(Math.max(0, Math.min(100, score)));
}

function deltaForFeatures(subject: string[] | undefined, comp: string[] | undefined, values: Record<string, number> | undefined): number {
  if (!values) return 0;
  const s = setOf(subject);
  const c = setOf(comp);
  let delta = 0;
  for (const [name, value] of Object.entries(values)) {
    const key = norm(name);
    if (s.has(key) && !c.has(key)) delta += value;
    if (!s.has(key) && c.has(key)) delta -= value;
  }
  return round(delta);
}

export function adjustComparable(subject: SubjectVehicle, comp: ComparableVehicle, policy: AdjustmentPolicy = {}): AdjustedComparable {
  const mileageRate = Number(policy.mileageRatePerMile ?? 0);
  const mileage = typeof subject.mileage === 'number' && typeof comp.mileage === 'number'
    ? round((comp.mileage - subject.mileage) * mileageRate)
    : 0;
  const options = deltaForFeatures(subject.options, comp.options, policy.optionValues);
  const equipment = deltaForFeatures(subject.equipment, comp.equipment, policy.equipmentValues);
  const depreciation = round(-comp.price * Math.max(0, Number(policy.depreciationPercent ?? 0)) / 100);
  const adjustedPrice = round(comp.price + mileage + options + equipment + depreciation);
  return {
    ...comp,
    adjustments: { mileage, options, equipment, depreciation },
    adjustedPrice,
    matchScore: scoreComparable(subject, comp),
  };
}

export function weightedAverage(sources: MoneySource[]): number | null {
  const valid = sources.filter((s) => Number.isFinite(s.value) && s.value > 0 && Number(s.weight ?? 1) > 0);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((a, s) => a + Number(s.weight ?? 1), 0);
  return round(valid.reduce((a, s) => a + s.value * Number(s.weight ?? 1), 0) / totalWeight);
}

export function suggestSearchRadius(count: number, currentRadiusMiles: number, targetCount = 6, maxRadiusMiles = 500): number {
  if (count >= targetCount) return currentRadiusMiles;
  const next = currentRadiusMiles <= 25 ? 50 : currentRadiusMiles <= 50 ? 100 : currentRadiusMiles <= 100 ? 200 : currentRadiusMiles * 2;
  return Math.min(maxRadiusMiles, next);
}

export function calculateMarketValuation(input: {
  subject: SubjectVehicle;
  comparables: ComparableVehicle[];
  selectedComparableIds?: string[];
  bookSources?: MoneySource[];
  policy?: AdjustmentPolicy;
  blendBookWeight?: number;
}): ValuationResult {
  const adjusted = input.comparables
    .map((c) => adjustComparable(input.subject, c, input.policy))
    .sort((a, b) => b.matchScore - a.matchScore);

  const selectedSet = new Set(input.selectedComparableIds ?? adjusted.slice(0, 6).map((c) => c.id));
  const selected = adjusted.filter((c) => selectedSet.has(c.id));
  if (!selected.length) throw new Error('at_least_one_comparable_required');

  const comparableAverage = round(selected.reduce((a, c) => a + c.adjustedPrice, 0) / selected.length);
  const weightedBookAverage = weightedAverage(input.bookSources ?? []);
  const bookWeight = weightedBookAverage === null ? 0 : Math.max(0, Math.min(1, Number(input.blendBookWeight ?? 0.25)));
  const preTaxValue = round(comparableAverage * (1 - bookWeight) + (weightedBookAverage ?? 0) * bookWeight);
  const tax = round(preTaxValue * Math.max(0, Number(input.policy?.taxPercent ?? 0)) / 100);
  const fixedFees = round(Math.max(0, Number(input.policy?.fixedFees ?? 0)));
  const indicatedValue = round(preTaxValue + tax + fixedFees);
  const averageScore = selected.reduce((a, c) => a + c.matchScore, 0) / selected.length;
  const countFactor = Math.min(1, selected.length / 6);
  const provenanceFactor = selected.filter((c) => c.sourceUrl && c.retrievedAt).length / selected.length;
  const integrityFactor = selected.filter((c) => c.sourceEvidenceHash || c.sourceSnapshotKey).length / selected.length;
  const confidence = round(Math.max(0, Math.min(100, averageScore * 0.6 + countFactor * 20 + provenanceFactor * 10 + integrityFactor * 10)));

  const evidence = [
    ...selected.map((c) => ({
      type: 'comparable' as const,
      id: c.id,
      source: c.source,
      sourceUrl: c.sourceUrl,
      retrievedAt: c.retrievedAt,
      value: c.adjustedPrice,
      evidenceHash: c.sourceEvidenceHash,
      snapshotKey: c.sourceSnapshotKey,
      snapshotMimeType: c.sourceSnapshotMimeType,
    })),
    ...(input.bookSources ?? []).map((s) => ({
      type: 'book_source' as const,
      id: s.name,
      source: s.name,
      sourceUrl: s.sourceUrl,
      retrievedAt: s.retrievedAt,
      value: round(s.value),
      evidenceHash: s.evidenceHash,
      licenseRef: s.licenseRef,
    })),
  ];

  return {
    adjustedComparables: adjusted,
    selectedComparableIds: selected.map((c) => c.id),
    comparableAverage,
    weightedBookAverage,
    preTaxValue,
    tax,
    fixedFees,
    indicatedValue,
    confidence,
    evidence,
  };
}
