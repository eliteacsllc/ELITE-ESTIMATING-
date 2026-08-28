import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Principal } from '../security/rbac.js';
import type { FeatureId } from '../platform/features.js';
import type { MeshCriticality } from './mesh.js';
import type { AgentMeshPlanningService } from './planning-service.js';

type Send = (res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>) => void;

export type AgentMeshHttpContext = {
  req: IncomingMessage;
  res: ServerResponse;
  actor: Principal;
  parts: string[];
  url: URL;
  service: AgentMeshPlanningService;
  send: Send;
};

export async function handleAgentMeshHttp(context: AgentMeshHttpContext): Promise<boolean> {
  const { req, res, actor, parts, url, service, send } = context;
  if (parts[0] !== 'v1' || parts[1] !== 'estimates' || !parts[2] || parts[3] !== 'agent-mesh') return false;
  if (parts.length !== 5 || parts[4] !== 'plan' || req.method !== 'GET') return false;
  const feature = url.searchParams.get('feature');
  const criticality = url.searchParams.get('criticality') ?? 'important';
  const utilizationText = url.searchParams.get('utilization') ?? '0.5';
  const utilization = Number(utilizationText);
  const result = await service.plan(actor, parts[2], {
    feature: feature as FeatureId,
    criticality: criticality as MeshCriticality,
    utilization,
  });
  send(res, 200, result);
  return true;
}
