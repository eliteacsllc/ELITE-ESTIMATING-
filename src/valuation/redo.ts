import type { ComparableProvider, ComparableSearchRequest } from './provider.js';
import { searchComparablesWithExpansion } from './provider.js';
import type { AdjustmentPolicy, MoneySource, SubjectVehicle } from './market-valuation.js';
import { calculateMarketValuation } from './market-valuation.js';
import { createValuationRevision, type ValuationRevision } from './revisions.js';

export type ValuationRedoInput = {
  priorRevision: ValuationRevision;
  provider: ComparableProvider;
  subject: SubjectVehicle;
  postalCode?: string;
  bookSources?: MoneySource[];
  policy?: AdjustmentPolicy;
  blendBookWeight?: number;
  requestedBy: string;
  startRadiusMiles?: number;
  maxRadiusMiles?: number;
  targetCount?: number;
};

export async function redoValuationWithWiderSearch(input: ValuationRedoInput) {
  if (!input.priorRevision?.id) throw new Error('prior_revision_required');
  const priorRadius = Number((input.priorRevision.metadata as Record<string, unknown> | undefined)?.searchRadiusMiles ?? 25);
  const start = Math.max(Number(input.startRadiusMiles ?? priorRadius * 2), priorRadius + 1);
  const search = await searchComparablesWithExpansion({
    provider: input.provider,
    request: { subject: input.subject, postalCode: input.postalCode, limit: Math.max(6, input.targetCount ?? 8), includeSold: true } as Omit<ComparableSearchRequest, 'radiusMiles'>,
    initialRadiusMiles: start,
    maxRadiusMiles: Math.max(start, Number(input.maxRadiusMiles ?? 500)),
    targetCount: Math.max(1, Number(input.targetCount ?? 8)),
  });
  if (!search.comparables.length) throw new Error('redo_no_comparables_found');
  const result = calculateMarketValuation({
    subject: input.subject,
    comparables: search.comparables,
    bookSources: input.bookSources,
    policy: input.policy,
    blendBookWeight: input.blendBookWeight,
  });
  const revision = createValuationRevision({
    claimId: input.priorRevision.claimId,
    kind: input.priorRevision.kind,
    createdBy: input.requestedBy,
    reason: 'redo_wider_market_search',
    supersedes: input.priorRevision.id,
    result,
    metadata: {
      searchRadiusMiles: search.radiusMiles,
      attemptedRadii: search.attemptedRadii,
      provider: search.provider,
      sourceRequestId: search.sourceRequestId,
    },
  });
  return { search, result, revision };
}
