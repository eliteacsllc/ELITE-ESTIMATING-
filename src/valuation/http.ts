import type { Principal } from '../security/rbac.js';
import { calculateMarketValuation } from './market-valuation.js';
import { calculateDiminishedValue } from './diminished-value.js';
import { buildFairMarketValuePacket, buildDiminishedValuePacket } from './report-packet.js';
import { renderValuationReportHtml } from './report-html.js';
import { createValuationRevision } from './revisions.js';
import { createDemandLetter } from './demand-letter.js';

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
  demand?: {
    claimantName?: string;
    insurerName?: string;
    claimNumber?: string;
    vehicleDescription?: string;
    lossDate?: string;
    requestedAmount?: number;
    responseDeadlineDays?: number;
    senderName?: string;
    senderCompany?: string;
  };
};

function demandDraft(input: ValuationHttpRequest, revision: ReturnType<typeof createValuationRevision>) {
  if (!input.demand) return undefined;
  return createDemandLetter({ ...input.demand, claimNumber: input.demand.claimNumber ?? input.claimId, valuation: revision });
}

function subjectForReport(subject: Record<string, unknown>) {
  return {
    vin: typeof subject.vin === 'string' ? subject.vin : undefined,
    year: typeof subject.year === 'number' ? subject.year : undefined,
    make: typeof subject.make === 'string' ? subject.make : undefined,
    model: typeof subject.model === 'string' ? subject.model : undefined,
    trim: typeof subject.trim === 'string' ? subject.trim : undefined,
    mileage: typeof subject.mileage === 'number' ? subject.mileage : undefined,
  };
}

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
    const report = buildFairMarketValuePacket(subjectForReport(input.subject), result);
    return { result, revision, report, reportHtml: renderValuationReportHtml(report), demandLetterDraft: demandDraft(input, revision) };
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
  const report = buildDiminishedValuePacket(subjectForReport(input.subject), result);
  return { result, revision, report, reportHtml: renderValuationReportHtml(report), demandLetterDraft: demandDraft(input, revision) };
}
