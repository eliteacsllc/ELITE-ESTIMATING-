import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EstimatingService, UpdateEstimateDomainWorkflowStepInput } from '../application/estimating-service.js';
import type { Principal } from '../security/rbac.js';
import type { RepairPlanningChecklist } from './repair-planning.js';
import { runValuationRequest, type ValuationHttpRequest } from '../valuation/http.js';
import { CanonicalHttpComparableProvider, CanonicalHttpEvidenceCaptureProvider } from '../valuation/http-providers.js';
import { searchComparablesWithExpansion } from '../valuation/provider.js';
import { assetSearchPolicy, normalizeMultiAssetSubject, type MultiAssetSubject, type ValuationAssetClass } from '../valuation/multi-asset.js';

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
        ...(typeof body.postalCode === 'string' ? {postalCode:body.postalCode} : {}),
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
    const result = await evidenceCaptureProviderFromEnv().capture({ comparableId, sourceUrl, ...(typeof body.retrievedAt === 'string' ? {retrievedAt:body.retrievedAt} : {}) });
    send(res, 200, result);
    return true;
  }

  if (parts[0] !== 'v1' || parts[1] !== 'estimates' || !parts[2]) return false;
  const estimateId = parts[2];

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
