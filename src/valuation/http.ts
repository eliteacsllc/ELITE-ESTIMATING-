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
  const claimNumber = input.demand.claimNumber ?? input.claimId;
  return createDemandLetter({ ...input.demand, ...(claimNumber !== undefined ? {claimNumber} : {}), valuation: revision });
}

function subjectForReport(subject: Record<string, unknown>) {
  return {
    ...(typeof subject.vin === 'string' ? {vin:subject.vin} : {}),
    ...(typeof subject.year === 'number' ? {year:subject.year} : {}),
    ...(typeof subject.make === 'string' ? {make:subject.make} : {}),
    ...(typeof subject.model === 'string' ? {model:subject.model} : {}),
    ...(typeof subject.trim === 'string' ? {trim:subject.trim} : {}),
    ...(typeof subject.mileage === 'number' ? {mileage:subject.mileage} : {}),
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
      ...(input.selectedComparableIds !== undefined ? {selectedComparableIds:input.selectedComparableIds} : {}),
      ...(input.bookSources !== undefined ? {bookSources:input.bookSources as never} : {}),
      ...(input.policy !== undefined ? {policy:input.policy as never} : {}),
      ...(input.blendBookWeight !== undefined ? {blendBookWeight:input.blendBookWeight} : {}),
    });
    const revision = createValuationRevision({
      ...(input.claimId !== undefined ? {claimId:input.claimId} : {}),
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
    ...(input.selectedComparableIds !== undefined ? {selectedComparableIds:input.selectedComparableIds} : {}),
    ...(input.bookSources !== undefined ? {bookSources:input.bookSources as never} : {}),
    ...(input.policy !== undefined ? {policy:input.policy as never} : {}),
    ...(input.blendBookWeight !== undefined ? {blendBookWeight:input.blendBookWeight} : {}),
    damageAdjustments: (input.damageAdjustments ?? []) as never,
    ...(input.postLossMarketEvidence !== undefined ? {postLossMarketEvidence:input.postLossMarketEvidence} : {}),
  });
  const revision = createValuationRevision({
    ...(input.claimId !== undefined ? {claimId:input.claimId} : {}),
    kind: 'diminished_value',
    createdBy: actor.userId,
    reason: input.reason ?? 'preliminary_diminished_value',
    result,
  });
  const report = buildDiminishedValuePacket(subjectForReport(input.subject), result);
  return { result, revision, report, reportHtml: renderValuationReportHtml(report), demandLetterDraft: demandDraft(input, revision) };
}
