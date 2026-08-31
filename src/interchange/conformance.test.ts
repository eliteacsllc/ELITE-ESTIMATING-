import assert from 'node:assert/strict';
import test from 'node:test';
import type { EstimateLine } from '../domain/types.js';
import { EliteJsonInterchangeAdapter } from './elite-json.js';
import { certifyInterchangeAdapter } from './conformance.js';

const fixture: EstimateLine[] = [{
  id: 'line-1', category: 'body', component: 'front door', operation: 'repair', quantity: 1,
  total: { amountMinor: 12500, currency: 'USD' }, humanApproved: true,
  provenance: [{ provider: 'expert', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'owned' }],
}];

test('Elite JSON adapter preserves canonical estimate-line semantics', async () => {
  const result = await certifyInterchangeAdapter({ adapter: new EliteJsonInterchangeAdapter(), contentType: 'application/json', fixture });
  assert.equal(result.green, true, result.blockers.join(','));
  assert.equal(result.importedLineCount, 1);
  assert.ok(result.exportedBytes > 0);
});

test('conformance rejects adapters that cannot recognize their own export', async () => {
  const adapter = {
    id: 'broken-adapter',
    canImport: () => false,
    import: async () => ({ sourceSystem: 'broken', lines: [], warnings: [] }),
    export: async () => new TextEncoder().encode('{}'),
  };
  const result = await certifyInterchangeAdapter({ adapter, contentType: 'application/json', fixture });
  assert.equal(result.green, false);
  assert.ok(result.blockers.includes('round_trip_not_recognized'));
});
