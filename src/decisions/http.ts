import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Principal } from '../security/rbac.js';
import type { TotalLossInput } from '../engine/total-loss.js';
import type { GovernedDecisionService, PartsDecisionInput, RepairReplaceDecisionInput } from './service.js';

type Send = (res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>) => void;
type JsonReader = (req: IncomingMessage) => Promise<Record<string, unknown>>;

export type DecisionHttpContext = {
  req: IncomingMessage;
  res: ServerResponse;
  actor: Principal;
  parts: string[];
  url: URL;
  service: GovernedDecisionService;
  send: Send;
  json: JsonReader;
};

export async function handleDecisionHttp(context: DecisionHttpContext): Promise<boolean> {
  const { req, res, actor, parts, url, service, send, json } = context;
  if (parts[0] !== 'v1' || parts[1] !== 'estimates' || !parts[2] || parts[3] !== 'decisions') return false;
  const estimateId = parts[2];

  if (parts.length === 4 && req.method === 'GET') {
    const requested = Number(url.searchParams.get('limit') ?? 100);
    const limit = Number.isFinite(requested) ? requested : 100;
    send(res, 200, await service.list(actor, estimateId, limit));
    return true;
  }

  if (parts.length !== 5 || req.method !== 'POST') return false;
  const body = await json(req);
  const endpoint = parts[4];
  const result = endpoint === 'parts'
    ? await service.optimizeParts(actor, estimateId, body as unknown as PartsDecisionInput)
    : endpoint === 'repair-replace'
      ? await service.repairOrReplace(actor, estimateId, body as unknown as RepairReplaceDecisionInput)
      : endpoint === 'total-loss'
        ? await service.totalLoss(actor, estimateId, body as unknown as TotalLossInput)
        : null;
  if (!result) return false;
  send(res, result.replayed ? 200 : 201, result, { 'idempotency-replayed': String(result.replayed) });
  return true;
}
