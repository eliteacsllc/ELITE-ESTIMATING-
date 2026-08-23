import test from 'node:test';
import assert from 'node:assert/strict';
import { EliteJsonInterchangeAdapter } from './elite-json.js';
import type { Estimate } from '../domain/types.js';

const estimate: Estimate = {
  id: 'e1', tenantId: 't1', asset: { assetClass: 'contents' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  lines: [], subtotal: { amountMinor: 0, currency: 'USD' }, tax: { amountMinor: 0, currency: 'USD' }, total: { amountMinor: 0, currency: 'USD' },
  status: 'draft', revision: 1, createdAt: '2026-08-23T00:00:00Z', updatedAt: '2026-08-23T00:00:00Z',
};

test('exports and recognizes canonical estimate envelope', async () => {
  const adapter = new EliteJsonInterchangeAdapter();
  const payload = adapter.exportEstimate(estimate);
  assert.equal(adapter.canImport('application/json', payload), true);
  const imported = await adapter.import(payload);
  assert.equal(imported.sourceEstimateId, 'e1');
  assert.equal(imported.lines.length, 0);
});
