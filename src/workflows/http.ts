import type { IncomingMessage, ServerResponse } from 'node:http';
import type { EstimatingService, UpdateEstimateDomainWorkflowStepInput } from '../application/estimating-service.js';
import type { Principal } from '../security/rbac.js';
import type { RepairPlanningChecklist } from './repair-planning.js';

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

export async function handleEstimateWorkflowHttp(context: WorkflowHttpContext): Promise<boolean> {
  const { req, res, actor, parts, service, send, json } = context;
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
