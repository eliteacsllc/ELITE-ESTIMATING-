import type { Principal } from '../security/rbac.js';
import { calculateMarketValuation } from './market-valuation.js';
import { calculateDiminishedValue } from './diminished-value.js';
import { calculateAcv } from './acv-engine.js';
import { buildFairMarketValuePacket, buildAcvPacket, buildDiminishedValuePacket } from './report-packet.js';
import { renderValuationReportHtml } from './report-html.js';
import { createValuationRevision } from './revisions.js';
import { createDemandLetter } from './demand-letter.js';
import { evaluateJurisdiction, type ValuationJurisdictionRule } from './jurisdiction.js';
import { evaluateValuationRelease } from './release-gate.js';

export type ValuationHttpRequest = {
  kind: 'market_value' | 'acv' | 'diminished_value';
  claimId?: string;
  subject: Record<string, unknown>;
  comparables: Record<string, unknown>[];
  selectedComparableIds?: string[];
  bookSources?: Record<string, unknown>[];
  policy?: Record<string, unknown>;
  blendBookWeight?: number;
  condition?: Record<string, unknown>[];
  damageAdjustments?: Record<string, unknown>[];
  postLossMarketEvidence?: number;
  include17cReference?: boolean;
  reason?: string;
  jurisdiction?: {
    rule: ValuationJurisdictionRule;
    lossDate: string;
    claimType: 'first_party'|'third_party'|'appraisal'|'litigation_support';
    liabilityAccepted?: boolean;
  };
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

function jurisdictionDecision(input:ValuationHttpRequest,kind:'acv'|'diminished_value'){
  if(!input.jurisdiction) return undefined;
  return evaluateJurisdiction({...input.jurisdiction,kind});
}

export function runValuationRequest(actor: Principal, input: ValuationHttpRequest) {
  if (!input || !['market_value','acv','diminished_value'].includes(input.kind)) throw new Error('valuation_kind_required');
  if (!input.subject || typeof input.subject !== 'object') throw new Error('valuation_subject_required');
  if (!Array.isArray(input.comparables) || input.comparables.length === 0) throw new Error('valuation_comparables_required');

  if (input.kind === 'market_value') {
    const result = calculateMarketValuation({
      subject: input.subject as never, comparables: input.comparables as never,
      selectedComparableIds: input.selectedComparableIds, bookSources: input.bookSources as never,
      policy: input.policy as never, blendBookWeight: input.blendBookWeight,
    });
    const revision = createValuationRevision({claimId:input.claimId,kind:'market_value',createdBy:actor.userId,reason:input.reason??'preliminary_market_valuation',result});
    const report=buildFairMarketValuePacket(subjectForReport(input.subject),result);
    return {result,revision,report,reportHtml:renderValuationReportHtml(report),demandLetterDraft:demandDraft(input,revision)};
  }

  if(input.kind==='acv'){
    const result=calculateAcv({
      subject:input.subject as never,comparables:input.comparables as never,selectedComparableIds:input.selectedComparableIds,
      bookSources:input.bookSources as never,policy:input.policy as never,blendBookWeight:input.blendBookWeight,condition:input.condition as never
    });
    const revision=createValuationRevision({claimId:input.claimId,kind:'acv',createdBy:actor.userId,reason:input.reason??'preliminary_acv',result});
    const jd=jurisdictionDecision(input,'acv');
    const release=evaluateValuationRelease({kind:'acv',subject:subjectForReport(input.subject),result,jurisdiction:jd,methodologyVersion:result.methodVersion});
    const report=buildAcvPacket(subjectForReport(input.subject),result);
    return {result,revision,jurisdiction:jd,release,report,reportHtml:renderValuationReportHtml(report),demandLetterDraft:demandDraft(input,revision)};
  }

  const result = calculateDiminishedValue({
    subject: input.subject as never, comparables: input.comparables as never,
    selectedComparableIds: input.selectedComparableIds, bookSources: input.bookSources as never,
    policy: input.policy as never, blendBookWeight: input.blendBookWeight,
    damageAdjustments: (input.damageAdjustments ?? []) as never,
    postLossMarketEvidence: input.postLossMarketEvidence, include17cReference:input.include17cReference,
  });
  const revision = createValuationRevision({claimId:input.claimId,kind:'diminished_value',createdBy:actor.userId,reason:input.reason??'preliminary_diminished_value',result});
  const jd=jurisdictionDecision(input,'diminished_value');
  const release=evaluateValuationRelease({kind:'diminished_value',subject:subjectForReport(input.subject),result,jurisdiction:jd,methodologyVersion:result.methodVersion});
  const report=buildDiminishedValuePacket(subjectForReport(input.subject),result);
  return {result,revision,jurisdiction:jd,release,report,reportHtml:renderValuationReportHtml(report),demandLetterDraft:demandDraft(input,revision)};
}
