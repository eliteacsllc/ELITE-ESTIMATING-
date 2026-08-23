import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const secret = process.env.ELITE_AUTH_SECRET;
const port = Number(process.env.PORT ?? 8787);
if (!secret || secret.length < 32) throw new Error('ELITE_AUTH_SECRET is required');

function sign(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}

const token = sign({
  userId: 'ci-http-smoke',
  tenantId: 'ci-http-smoke-tenant',
  roles: ['tenant_admin'],
  exp: Math.floor(Date.now() / 1000) + 600,
});
const base = `http://127.0.0.1:${port}`;
const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

async function expectJson(response: Response, status: number): Promise<Record<string, unknown>> {
  const text = await response.text();
  assert.equal(response.status, status, `expected HTTP ${status}, received ${response.status}: ${text}`);
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

const estimateKey = 'ci-estimate-idempotency-0001';
const estimateBody = JSON.stringify({
  asset: { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352' },
  locale: 'en-US',
  currency: 'USD',
  jurisdiction: 'US',
});
const firstEstimateResponse = await fetch(`${base}/v1/estimates`, {
  method: 'POST',
  headers: { ...authHeaders, 'idempotency-key': estimateKey },
  body: estimateBody,
});
const firstEstimate = await expectJson(firstEstimateResponse, 201);
assert.equal(firstEstimateResponse.headers.get('idempotency-replayed'), 'false');
assert.ok(typeof firstEstimate.id === 'string');

const replayEstimateResponse = await fetch(`${base}/v1/estimates`, {
  method: 'POST',
  headers: { ...authHeaders, 'idempotency-key': estimateKey },
  body: estimateBody,
});
const replayEstimate = await expectJson(replayEstimateResponse, 200);
assert.equal(replayEstimateResponse.headers.get('idempotency-replayed'), 'true');
assert.equal(replayEstimate.id, firstEstimate.id);

const conflictEstimateResponse = await fetch(`${base}/v1/estimates`, {
  method: 'POST',
  headers: { ...authHeaders, 'idempotency-key': estimateKey },
  body: JSON.stringify({
    asset: { assetClass: 'commercial_vehicle' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
  }),
});
await expectJson(conflictEstimateResponse, 409);

const estimateId = String(firstEstimate.id);
await expectJson(await fetch(`${base}/v1/estimates/${estimateId}/approve`, {
  method: 'POST',
  headers: authHeaders,
}), 200);

const supplementKey = 'ci-supplement-idempotency-0001';
const firstSupplementResponse = await fetch(`${base}/v1/estimates/${estimateId}/supplements`, {
  method: 'POST',
  headers: { ...authHeaders, 'idempotency-key': supplementKey },
});
const firstSupplement = await expectJson(firstSupplementResponse, 201);
assert.equal(firstSupplementResponse.headers.get('idempotency-replayed'), 'false');
assert.ok(typeof firstSupplement.id === 'string');

const replaySupplementResponse = await fetch(`${base}/v1/estimates/${estimateId}/supplements`, {
  method: 'POST',
  headers: { ...authHeaders, 'idempotency-key': supplementKey },
});
const replaySupplement = await expectJson(replaySupplementResponse, 200);
assert.equal(replaySupplementResponse.headers.get('idempotency-replayed'), 'true');
assert.equal(replaySupplement.id, firstSupplement.id);

console.log('HTTP idempotency smoke passed');
