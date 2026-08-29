import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Principal } from '../security/rbac.js';
import type { GovernedDecisionService } from './service.js';
import { handleDecisionHttp } from './http.js';

const actor: Principal = { userId: 'estimator-a', tenantId: 'tenant-a', roles: ['estimator'] };

function request(method: string): IncomingMessage {
  return { method } as unknown as IncomingMessage;
}

function response(): ServerResponse {
  return {} as unknown as ServerResponse;
}

test('GET agent-mesh-plan forwards bounded query inputs and is read-only', async () => {
  let received: Record<string, unknown> | null = null;
  const service = {
    async agentMeshPlan(_actor: Principal, estimateId: string, input: Record<string, unknown>) {
      received = { estimateId, ...input };
      return { feature: input.feature, humanApprovalRequired: true, automaticFinalMutationAllowed: false };
    },
  } as unknown as GovernedDecisionService;
  const sent: Array<{ status: number; body: unknown }> = [];
  const handled = await handleDecisionHttp({
    req: request('GET'),
    res: response(),
    actor,
    parts: ['v1','estimates','estimate-1','decisions','agent-mesh-plan'],
    url: new URL('http://localhost/v1/estimates/estimate-1/decisions/agent-mesh-plan?feature=parts_optimizer&criticality=safety_critical&utilization=0.75'),
    service,
    send: (_res, status, body) => { sent.push({ status, body }); },
    json: async () => { throw new Error('GET planner must not read a request body'); },
  });
  assert.equal(handled, true);
  assert.deepEqual(received, { estimateId: 'estimate-1', feature: 'parts_optimizer', criticality: 'safety_critical', utilization: 0.75 });
  assert.equal(sent[0]?.status, 200);
  assert.deepEqual(sent[0]?.body, { feature: 'parts_optimizer', humanApprovalRequired: true, automaticFinalMutationAllowed: false });
});

test('POST agent-mesh-plan is not an accepted execution or vote-submission route', async () => {
  const service = { agentMeshPlan: async () => { throw new Error('must_not_execute'); } } as unknown as GovernedDecisionService;
  const handled = await handleDecisionHttp({
    req: request('POST'),
    res: response(),
    actor,
    parts: ['v1','estimates','estimate-1','decisions','agent-mesh-plan'],
    url: new URL('http://localhost/v1/estimates/estimate-1/decisions/agent-mesh-plan?feature=parts_optimizer'),
    service,
    send: () => { throw new Error('must_not_send'); },
    json: async () => ({}),
  });
  assert.equal(handled, false);
});
