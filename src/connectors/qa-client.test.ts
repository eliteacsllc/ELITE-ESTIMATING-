import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewDraftIQWithQa } from './qa-client.js';

test('posts DraftIQ draft to tenant-scoped QA endpoint', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ status: 'review', requiresHumanApproval: true, findings: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await reviewDraftIQWithQa(
    { baseUrl: 'http://localhost:8080', token: 'token', tenantId: 'elite' },
    { version:'1.0', mode:'preliminary', generatedAt:'2026-10-01T00:00:00Z', confidence:0.9, lines:[], missingEvidence:[], requiresHumanApproval:true },
    'req-1',
    fetchImpl,
  );
  assert.equal(result.status, 'review');
  assert.equal(calls[0]?.url, 'http://localhost:8080/v1/draftiq/review');
  assert.equal(new Headers(calls[0]?.init?.headers).get('x-tenant-id'), 'elite');
});
