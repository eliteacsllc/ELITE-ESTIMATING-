import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePartsFeeds } from './parts-exchange.js';

const provenance = [{ provider: 'feed', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'licensed' as const }];

test('merges providers and detects equivalent part numbers', () => {
  const result = mergePartsFeeds([
    { providerId: 'a', retrievedAt: '2026-08-30T00:00:00Z', candidates: [{ id: 'a1', description: 'Bumper', sourceType: 'new_oem', partNumber: 'ABC-123', price: { amountMinor: 50000, currency: 'USD' }, provenance }] },
    { providerId: 'b', retrievedAt: '2026-08-30T00:00:00Z', candidates: [{ id: 'b1', description: 'Bumper', sourceType: 'new_oem', partNumber: 'ABC123', price: { amountMinor: 45000, currency: 'USD' }, provenance }] },
  ]);
  assert.deepEqual(result.providers, ['a','b']);
  assert.equal(result.collisions.length, 1);
  assert.deepEqual(result.collisions[0]?.candidateIds, ['a1','b1']);
});
