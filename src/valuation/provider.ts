import type { ComparableVehicle, SubjectVehicle } from './market-valuation.js';

export type ComparableSearchRequest = {
  subject: SubjectVehicle;
  postalCode?: string;
  radiusMiles: number;
  limit?: number;
  includeSold?: boolean;
};

export type ComparableSearchResult = {
  provider: string;
  searchedAt: string;
  radiusMiles: number;
  comparables: ComparableVehicle[];
  sourceRequestId?: string;
};

export interface ComparableProvider {
  readonly name: string;
  search(request: ComparableSearchRequest): Promise<ComparableSearchResult>;
}

export async function searchComparablesWithExpansion(input: {
  provider: ComparableProvider;
  request: Omit<ComparableSearchRequest, 'radiusMiles'>;
  initialRadiusMiles?: number;
  maxRadiusMiles?: number;
  targetCount?: number;
}): Promise<ComparableSearchResult & { attemptedRadii: number[] }> {
  const initial = Math.max(1, Number(input.initialRadiusMiles ?? 25));
  const max = Math.max(initial, Number(input.maxRadiusMiles ?? 500));
  const target = Math.max(1, Number(input.targetCount ?? 6));
  const attemptedRadii: number[] = [];
  let radius = initial;
  let latest: ComparableSearchResult | null = null;

  while (radius <= max) {
    attemptedRadii.push(radius);
    latest = await input.provider.search({ ...input.request, radiusMiles: radius });
    if (latest.comparables.length >= target || radius === max) break;
    radius = Math.min(max, radius * 2);
    if (attemptedRadii.includes(radius)) break;
  }

  if (!latest) {
    return { provider: input.provider.name, searchedAt: new Date().toISOString(), radiusMiles: initial, comparables: [], attemptedRadii };
  }
  return { ...latest, attemptedRadii };
}
