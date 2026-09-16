import type { Principal } from '../security/rbac.js';
import { calculateMarketValuation } from './market-valuation.js';
import { calculateDiminishedValue } from './diminished-value.js';
import { createFairMarketValuePacket, createDiminishedValuePacket } from './report-packet.js';
import { createValuationRevision } from './revisions.js';

export type ValuationHttpRequest = {
  kind: 'market_value' | 'diminished_value';
  claimId?: string;
  subject: Record<string, unknown>;
  comparables: Record<string, unknown>[];
  selectedComparableIds?: string[];
  bookSources?: Record<string, unknown>[];
  policy?: Record<string, unknown>;
  blendBookWeight?: number;
  damageAdjustments?: Record<string, unknown>[];
  postLossMarketEvidence?: number;
  reason?: string;
};

export function runValuationRequest(actor: Principal, input: ValuationHttpRequest) {
  if (!input || (input.kind !== 'market_value' && input.kind !== 'diminished_value')) throw new Error('valuation_kind_required');
  if (!input.subject || typeof input.subject !== 'object') throw new Error('valuation_subject_required');
  if (!Array.isArray(input.comparables) || input.comparables.length === 0) throw new Error('valuation_comparables_required');

  if (input.kind === 'market_value') {
    const result = calculateMarketValuation({
      subject: input.subject as never,
      comparables: input.comparables as never,
      selectedComparableIds: input.selectedComparableIds,
      bookSources: input.bookSources as never,
      policy: input.policy as never,
      blendBookWeight: input.blendBookWeight,
    });
    const revision = createValuationRevision({
      claimId: input.claimId,
      kind: 'market_value',
      createdBy: actor.userId,
      reason: input.reason ?? 'preliminary_market_valuation',
      result,
    });
    return { result, revision, report: createFairMarketValuePacket({ claimId: input.claimId, result }) };
  }

  const result = calculateDiminishedValue({
    subject: input.subject as never,
    comparables: input.comparables as never,
    selectedComparableIds: input.selectedComparableIds,
    bookSources: input.bookSources as never,
    policy: input.policy as never,
    blendBookWeight: input.blendBookWeight,
    damageAdjustments: (input.damageAdjustments ?? []) as never,
    postLossMarketEvidence: input.postLossMarketEvidence,
  });
  const revision = createValuationRevision({
    claimId: input.claimId,
    kind: 'diminished_value',
    createdBy: actor.userId,
    reason: input.reason ?? 'preliminary_diminished_value',
    result,
  });
  return { result, revision, report: createDiminishedValuePacket({ claimId: input.claimId, result }) };
}
