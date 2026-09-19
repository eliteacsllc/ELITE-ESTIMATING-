import assert from 'node:assert/strict';
import test from 'node:test';
import { queryEstimatics } from './estimatics-client.js';

const envelope = {
  schema_version: 'elite.repair-knowledge.v1',
  consumer: 'elite-estimating',
  tenant_id: 'tenant-a',
  request_id: 'req-1',
  query: { year: 2024, make: 'Example' },
  items: [],
  blocked_record_ids: [],
  warnings: [],
  source_receipt_digest: 'receipt',
  failure_mode: 'fail_closed',
  requires_human_review: false,
  envelope_digest: 'digest',
};

test('Estimatics client sends tenant auth and request id', async () => {
  let captured: any;
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const value = await queryEstimatics({
    baseUrl: 'https://estimatics.example',
    token: 'secret',
    tenantId: 'tenant-a',
  }, { year: 2024, make: 'Example' }, 'req-1', fetchImpl as typeof fetch);
  assert.equal(value.tenant_id, 'tenant-a');
  assert.equal(captured.init.headers['x-tenant-id'], 'tenant-a');
  assert.equal(captured.init.headers.authorization, 'Bearer secret');
  assert.equal(captured.init.headers['x-request-id'], 'req-1');
});

test('Estimatics client retries transient upstream failure', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return new Response('{}', { status: 503 });
    return new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await queryEstimatics({ baseUrl: 'https://estimatics.example', token: 'secret', tenantId: 'tenant-a', retries: 1 },
    { year: 2024, make: 'Example' }, 'req-1', fetchImpl as typeof fetch);
  assert.equal(calls, 2);
});

test('Estimatics client does not allow insecure remote transport', async () => {
  await assert.rejects(() => queryEstimatics({
    baseUrl: 'http://example.com', token: 'secret', tenantId: 'tenant-a',
  }, { year: 2024, make: 'Example' }, 'req-1'), /https_required/);
});
