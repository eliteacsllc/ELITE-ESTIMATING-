import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const secret = process.env.ELITE_AUTH_SECRET ?? '';
const port = Number(process.env.PORT ?? 8787);
if (secret.length < 32) throw new Error('ELITE_AUTH_SECRET is required');

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
const estimatorToken = sign({
  userId: 'ci-http-estimator',
  tenantId: 'ci-http-smoke-tenant',
  roles: ['estimator'],
  exp: Math.floor(Date.now() / 1000) + 600,
});
const base = `http://127.0.0.1:${port}`;
const authHeaders = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const estimatorHeaders = { authorization: `Bearer ${estimatorToken}`, 'content-type': 'application/json' };

async function expectJson(response: Response, status: number): Promise<Record<string, unknown>> {
  const text = await response.text();
  assert.equal(response.status, status, `expected HTTP ${status}, received ${response.status}: ${text}`);
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

const featureProfile = await expectJson(await fetch(`${base}/v1/platform/features/passenger_vehicle`, {
  method: 'PUT',
  headers: authHeaders,
  body: JSON.stringify({
    enabledFeatures: ['motor_raced', 'adas_diagnostics', 'parts_optimizer', 'repair_replace', 'total_loss'],
    automationLevel: 'copilot',
  }),
}), 200);
assert.equal(featureProfile.automationLevel, 'copilot');
assert.ok(Array.isArray(featureProfile.enabledFeatures));
assert.ok((featureProfile.enabledFeatures as unknown[]).includes('labor_intelligence'));
assert.ok((featureProfile.enabledFeatures as unknown[]).includes('oem_procedures'));
assert.ok((featureProfile.enabledFeatures as unknown[]).includes('market_comps'));

const readableProfile = await expectJson(await fetch(`${base}/v1/platform/features/passenger_vehicle`, {
  headers: estimatorHeaders,
}), 200);
assert.equal(readableProfile.automationLevel, 'copilot');

await expectJson(await fetch(`${base}/v1/platform/features/passenger_vehicle`, {
  method: 'PUT',
  headers: estimatorHeaders,
  body: JSON.stringify({ enabledFeatures: [], automationLevel: 'manual' }),
}), 403);

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
const decisionBody = JSON.stringify({
  candidates: [
    {
      id: 'oem-part', description: 'Test panel', sourceType: 'new_oem',
      price: { amountMinor: 25000, currency: 'USD' }, leadTimeDays: 1,
      certification: 'OEM', warrantyMonths: 36, oemProcedureCompatible: true,
      provenance: [{ provider: 'ci-licensed-provider', retrievedAt: '2026-08-25T12:00:00.000Z', licenseClass: 'licensed' }],
    },
    {
      id: 'recycled-part', description: 'Test panel', sourceType: 'recycled',
      price: { amountMinor: 15000, currency: 'USD' }, leadTimeDays: 3,
      conditionGrade: 'A', warrantyMonths: 6, oemProcedureCompatible: true,
      provenance: [{ provider: 'ci-licensed-provider', retrievedAt: '2026-08-25T12:00:00.000Z', licenseClass: 'licensed' }],
    },
  ],
  policy: { currency: 'USD', allowedSourceTypes: ['new_oem', 'recycled'], requireOemProcedureCompatibility: true },
});
const firstDecisionResponse = await fetch(`${base}/v1/estimates/${estimateId}/decisions/parts`, {
  method: 'POST', headers: authHeaders, body: decisionBody,
});
const firstDecision = await expectJson(firstDecisionResponse, 201);
assert.equal(firstDecisionResponse.headers.get('idempotency-replayed'), 'false');
assert.ok(typeof (firstDecision.record as Record<string, unknown>)?.id === 'string');

const replayDecisionResponse = await fetch(`${base}/v1/estimates/${estimateId}/decisions/parts`, {
  method: 'POST', headers: authHeaders, body: decisionBody,
});
const replayDecision = await expectJson(replayDecisionResponse, 200);
assert.equal(replayDecisionResponse.headers.get('idempotency-replayed'), 'true');
assert.equal((replayDecision.record as Record<string, unknown>).id, (firstDecision.record as Record<string, unknown>).id);

const decisionHistory = await expectJson(await fetch(`${base}/v1/estimates/${estimateId}/decisions`, { headers: estimatorHeaders }), 200);
assert.ok(Array.isArray(decisionHistory));
assert.equal(decisionHistory.length, 1);

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

console.log('HTTP idempotency, tenant entitlement, and governed decision smoke passed');
