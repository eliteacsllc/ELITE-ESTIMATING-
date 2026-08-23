import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';

const secret = process.env.ELITE_AUTH_SECRET ?? '';
const configuredBase = process.env.ELITE_SMOKE_BASE_URL?.trim() ?? '';
if (secret.length < 32) throw new Error('ELITE_AUTH_SECRET is required');
if (!configuredBase) throw new Error('ELITE_SMOKE_BASE_URL is required');

const parsedBase = new URL(configuredBase);
if (!['http:', 'https:'].includes(parsedBase.protocol)) throw new Error('ELITE_SMOKE_BASE_URL must use HTTP or HTTPS');
if (parsedBase.username || parsedBase.password || parsedBase.search || parsedBase.hash) throw new Error('invalid ELITE_SMOKE_BASE_URL');
if (parsedBase.pathname !== '/' && parsedBase.pathname !== '') throw new Error('ELITE_SMOKE_BASE_URL must be an origin');
const base = configuredBase.replace(/\/$/, '');

function sign(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}

const runId = randomUUID();
const token = sign({
  userId: 'deployment-smoke',
  tenantId: 'deployment-smoke',
  roles: ['tenant_admin'],
  exp: Math.floor(Date.now() / 1000) + 300,
});
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

async function expectJson(response: Response, status: number): Promise<Record<string, unknown>> {
  const text = await response.text();
  assert.equal(response.status, status, `expected HTTP ${status}, received ${response.status}: ${text}`);
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

const health = await expectJson(await fetch(`${base}/health`), 200);
assert.equal(health.status, 'ok');
const ready = await expectJson(await fetch(`${base}/ready`), 200);
assert.equal(ready.status, 'ready');
assert.equal(ready.rateLimitDurable, true);
assert.equal(ready.rateLimitHealthy, true);

const idempotencyKey = `deployment-smoke-${runId}`;
const createResponse = await fetch(`${base}/v1/estimates`, {
  method: 'POST',
  headers: { ...headers, 'idempotency-key': idempotencyKey },
  body: JSON.stringify({
    claimId: `deployment-smoke-${runId}`,
    asset: { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
  }),
});
const created = await expectJson(createResponse, 201);
assert.equal(createResponse.headers.get('idempotency-replayed'), 'false');
assert.ok(typeof created.id === 'string' && created.id.length > 0);

const replayResponse = await fetch(`${base}/v1/estimates`, {
  method: 'POST',
  headers: { ...headers, 'idempotency-key': idempotencyKey },
  body: JSON.stringify({
    claimId: `deployment-smoke-${runId}`,
    asset: { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
  }),
});
const replayed = await expectJson(replayResponse, 200);
assert.equal(replayResponse.headers.get('idempotency-replayed'), 'true');
assert.equal(replayed.id, created.id);

const estimateId = String(created.id);
const fetched = await expectJson(await fetch(`${base}/v1/estimates/${estimateId}`, { headers }), 200);
assert.equal(fetched.id, estimateId);
assert.equal(fetched.claimId, `deployment-smoke-${runId}`);

const voided = await expectJson(await fetch(`${base}/v1/estimates/${estimateId}/void`, {
  method: 'POST',
  headers,
}), 200);
assert.equal(voided.id, estimateId);
assert.equal(voided.status, 'void');

console.log(`remote deployment smoke passed for ${base}`);
