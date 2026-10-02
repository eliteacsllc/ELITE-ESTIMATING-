import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EstimatingService, UpdateEstimateDomainWorkflowStepInput } from '../application/estimating-service.js';
import type { Principal } from '../security/rbac.js';
import type { RepairPlanningChecklist } from './repair-planning.js';
import { runValuationRequest, type ValuationHttpRequest } from '../valuation/http.js';
import { CanonicalHttpComparableProvider, CanonicalHttpEvidenceCaptureProvider } from '../valuation/http-providers.js';
import { searchComparablesWithExpansion } from '../valuation/provider.js';
import { assetSearchPolicy, normalizeMultiAssetSubject, type MultiAssetSubject, type ValuationAssetClass } from '../valuation/multi-asset.js';
import { buildDraftIQDraft, type BuildDraftIQInput } from '../intelligence/draftiq.js';
import { reviewDraftIQWithQa, type DraftIQQaResult } from '../connectors/qa-client.js';
import { queryEstimatics } from '../connectors/estimatics-client.js';
import { buildEstimaticsCompletenessQuery } from '../connectors/estimatics-completeness.js';
import { assessEstimaticsEnvelope, type EstimaticsEnvelope, type EstimaticsDecision } from '../connectors/estimatics.js';
import { damageIqCandidatesToDraftIQ, type DamageIqDraftCandidate } from '../integrations/damage-iq-draftiq.js';
import { buildEstimateCompletenessReview } from '../intelligence/estimate-completeness.js';
import { buildSupplementReviewDraft } from '../intelligence/supplement-review-draft.js';
import { analyzeTotalLoss, type TotalLossInput } from '../engine/total-loss.js';

type Send = (res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>) => void;
type JsonReader = (req: IncomingMessage) => Promise<Record<string, unknown>>;

export type WorkflowHttpContext = {
  req: IncomingMessage;
  res: ServerResponse;
  actor: Principal;
  parts: string[];
  service: EstimatingService;
  send: Send;
  json: JsonReader;
};

function comparableProviderFromEnv() {
  const baseUrl = process.env.ELITE_COMPARABLE_PROVIDER_URL?.trim();
  const token = process.env.ELITE_COMPARABLE_PROVIDER_TOKEN?.trim();
  if (!baseUrl || !token) throw new Error('comparable_provider_not_configured');
  return new CanonicalHttpComparableProvider({ name: process.env.ELITE_COMPARABLE_PROVIDER_NAME?.trim() || 'configured-comparable-provider', baseUrl, token });
}

function evidenceCaptureProviderFromEnv() {
  const baseUrl = process.env.ELITE_EVIDENCE_CAPTURE_URL?.trim();
  const token = process.env.ELITE_EVIDENCE_CAPTURE_TOKEN?.trim();
  if (!baseUrl || !token) throw new Error('evidence_capture_provider_not_configured');
  return new CanonicalHttpEvidenceCaptureProvider({ name: process.env.ELITE_EVIDENCE_CAPTURE_NAME?.trim() || 'configured-evidence-capture', baseUrl, token });
}

export async function handleEstimateWorkflowHttp(context: WorkflowHttpContext): Promise<boolean> {
  const { req, res, actor, parts, service, send, json } = context;

  if (parts.length === 2 && parts[0] === 'v1' && parts[1] === 'valuations' && req.method === 'POST') {
    const body = await json(req);
    send(res, 200, runValuationRequest(actor, body as unknown as ValuationHttpRequest));
    return true;
  }

  if (parts.length === 3 && parts[0] === 'v1' && parts[1] === 'valuations' && parts[2] === 'search' && req.method === 'POST') {
    const body = await json(req);
    if (!body.subject || typeof body.subject !== 'object' || Array.isArray(body.subject)) throw new Error('valuation_subject_required');
    const assetClass = String(body.assetClass ?? 'passenger_auto') as ValuationAssetClass;
    const policy = assetSearchPolicy(assetClass);
    const subject = normalizeMultiAssetSubject({ ...(body.subject as Record<string, unknown>), assetClass } as unknown as MultiAssetSubject);
    const result = await searchComparablesWithExpansion({
      provider: comparableProviderFromEnv(),
      request: {
        subject,
        postalCode: typeof body.postalCode === 'string' ? body.postalCode : undefined,
        limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : policy.targetComparableCount,
        includeSold: body.includeSold !== false,
      },
      initialRadiusMiles: Number.isFinite(Number(body.initialRadiusMiles)) ? Number(body.initialRadiusMiles) : policy.initialRadiusMiles,
      maxRadiusMiles: Number.isFinite(Number(body.maxRadiusMiles)) ? Number(body.maxRadiusMiles) : policy.maxRadiusMiles,
      targetCount: Number.isFinite(Number(body.targetCount)) ? Number(body.targetCount) : policy.targetComparableCount,
    });
    send(res, 200, { assetClass, policy, ...result });
    return true;
  }

  if (parts.length === 3 && parts[0] === 'v1' && parts[1] === 'valuations' && parts[2] === 'evidence-capture' && req.method === 'POST') {
    const body = await json(req);
    const comparableId = typeof body.comparableId === 'string' ? body.comparableId.trim() : '';
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    if (!comparableId) throw new Error('capture_comparable_id_required');
    if (!sourceUrl) throw new Error('capture_source_url_required');
    const result = await evidenceCaptureProviderFromEnv().capture({ comparableId, sourceUrl, retrievedAt: typeof body.retrievedAt === 'string' ? body.retrievedAt : undefined });
    send(res, 200, result);
    return true;
  }

  if (parts[0] !== 'v1' || parts[1] !== 'estimates' || !parts[2]) return false;
  const estimateId = parts[2];

  if (parts[3] === 'draftiq' && parts.length === 4 && req.method === 'POST') {
    const estimate = await service.get(actor, estimateId);
    const body = await json(req);
    const damageIqCandidates = Array.isArray(body.damageIqCandidates)
      ? body.damageIqCandidates as unknown as DamageIqDraftCandidate[]
      : null;
    const draftInput: BuildDraftIQInput = {
      ...(body as unknown as BuildDraftIQInput),
      candidates: damageIqCandidates
        ? damageIqCandidatesToDraftIQ(damageIqCandidates)
        : ((body.candidates ?? []) as unknown as BuildDraftIQInput['candidates']),
    };
    const draft = buildDraftIQDraft(draftInput);
    const requestId = String(req.headers['x-request-id'] ?? `draftiq-${estimateId}-r${estimate.revision}`);

    const estimaticsBaseUrl = process.env.ELITE_ESTIMATICS_SERVICE_URL?.trim();
    const estimaticsToken = process.env.ELITE_ESTIMATICS_SERVICE_TOKEN?.trim();
    const requireEstimatics = process.env.ELITE_REQUIRE_DRAFTIQ_ESTIMATICS === '1';
    let estimatics: { status: string; query?: unknown; envelope?: EstimaticsEnvelope; decision?: EstimaticsDecision } = { status: 'not_configured' };
    if (estimaticsBaseUrl && estimaticsToken) {
      const query = buildEstimaticsCompletenessQuery(estimate);
      const envelope = await queryEstimatics(
        { baseUrl: estimaticsBaseUrl, token: estimaticsToken, tenantId: actor.tenantId },
        query,
        requestId,
      );
      const decision = assessEstimaticsEnvelope(envelope, actor.tenantId);
      estimatics = { status: decision.blocked ? 'blocked' : decision.requiresHumanReview ? 'review' : 'ready', query, envelope, decision };
    } else if (requireEstimatics) {
      throw new Error('draftiq_estimatics_not_configured');
    }

    const qaBaseUrl = process.env.ELITE_QA_URL?.trim();
    const qaToken = process.env.ELITE_QA_TOKEN?.trim();
    const requireQa = process.env.ELITE_REQUIRE_DRAFTIQ_QA === '1';
    let qa: DraftIQQaResult = { status: 'not_configured', requiresHumanApproval: true, findings: [] };
    if (qaBaseUrl && qaToken) {
      qa = await reviewDraftIQWithQa(
        { baseUrl: qaBaseUrl, token: qaToken, tenantId: actor.tenantId },
        draft,
        requestId,
      );
    } else if (requireQa) {
      throw new Error('draftiq_qa_not_configured');
    }

    const completeness = buildEstimateCompletenessReview(estimate);
    const supplementReview = buildSupplementReviewDraft(estimate);
    let totalLossSignal: ReturnType<typeof analyzeTotalLoss> | null = null;
    if (body.totalLossInput && typeof body.totalLossInput === 'object' && !Array.isArray(body.totalLossInput)) {
      const requested = body.totalLossInput as unknown as TotalLossInput;
      totalLossSignal = analyzeTotalLoss({
        ...requested,
        currency: estimate.currency,
        repairCost: estimate.total,
      });
    }

    const evidenceBlocked = Boolean(estimatics.decision?.blocked) || draft.missingEvidence.length > 0;
    const qaBlocked = qa.status === 'blocked';
    const nextAction = evidenceBlocked || qaBlocked
      ? 'collect_or_resolve_evidence'
      : totalLossSignal?.recommendation === 'total_loss_indicator'
        ? 'valuation_review'
        : 'human_review';
    const lifecycleStatus = nextAction === 'collect_or_resolve_evidence'
      ? 'evidence_required'
      : nextAction === 'valuation_review'
        ? 'valuation_review'
        : draft.lines.some((line) => line.status === 'needs-review') || qa.status === 'review'
          ? 'review_required'
          : 'drafted';
    await service.recordDraftIQStatus(actor, estimateId, lifecycleStatus, {
      lineCount: draft.lines.length,
      confidence: draft.confidence,
      qaStatus: qa.status,
      estimaticsStatus: estimatics.status,
      nextAction,
      totalLossRecommendation: totalLossSignal?.recommendation ?? null,
    });
    send(res, 200, {
      estimateId,
      estimateRevision: estimate.revision,
      draft,
      estimatics,
      qa,
      completeness,
      supplementReview,
      totalLossSignal,
      nextAction,
      lifecycleStatus,
      canApprove: false,
      requiresHumanApproval: true,
    });
    return true;
  }


  if (parts[3] === 'repair-plan' && parts.length === 4) {
    if (req.method === 'GET') {
      const estimate = await service.get(actor, estimateId);
      send(res, 200, { repairPlan: estimate.repairPlan ?? null });
      return true;
    }
    if (req.method === 'PUT') {
      const body = await json(req);
      send(res, 200, await service.replaceRepairPlan(actor, estimateId, body as unknown as RepairPlanningChecklist));
      return true;
    }
  }

  if (parts[3] === 'domain-workflow') {
    if (parts.length === 4 && req.method === 'GET') {
      const estimate = await service.get(actor, estimateId);
      send(res, 200, { domainWorkflow: estimate.domainWorkflow ?? null });
      return true;
    }
    if (parts.length === 4 && req.method === 'POST') {
      send(res, 200, await service.initializeDomainWorkflow(actor, estimateId));
      return true;
    }
    if (parts.length === 5 && parts[4] === 'steps' && (req.method === 'PATCH' || req.method === 'POST')) {
      const body = await json(req);
      send(res, 200, await service.updateDomainWorkflowStep(actor, estimateId, body as unknown as UpdateEstimateDomainWorkflowStepInput));
      return true;
    }
  }

  return false;
}
