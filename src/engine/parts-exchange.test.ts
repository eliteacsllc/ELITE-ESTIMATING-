import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCertifiedPartsFeeds, mergePartsFeeds } from './parts-exchange.js';

const now = Date.parse('2026-08-31T02:00:00Z');
const provenance = [{ provider: 'feed', retrievedAt: '2026-08-31T01:55:00Z', licenseClass: 'licensed' as const }];

test('merges providers and detects equivalent part numbers', () => {
  const result = mergePartsFeeds([
    { providerId: 'a', retrievedAt: '2026-08-31T01:55:00Z', candidates: [{ id: 'a1', description: 'Bumper', sourceType: 'new_oem', partNumber: 'ABC-123', price: { amountMinor: 50000, currency: 'USD' }, provenance }] },
    { providerId: 'b', retrievedAt: '2026-08-31T01:55:00Z', candidates: [{ id: 'b1', description: 'Bumper', sourceType: 'new_oem', partNumber: 'ABC123', price: { amountMinor: 45000, currency: 'USD' }, provenance }] },
  ]);
  assert.deepEqual(result.providers, ['a','b']);
  assert.equal(result.collisions.length, 1);
  assert.deepEqual(result.collisions[0]?.candidateIds, ['a1','b1']);
});

test('certified exchange fails closed when any feed is invalid', () => {
  const valid = { providerId: 'feed', retrievedAt: '2026-08-31T01:55:00Z', candidates: [{ id: 'a1', description: 'Bumper', sourceType: 'new_oem' as const, partNumber: 'ABC-123', price: { amountMinor: 50000, currency: 'USD' }, provenance }] };
  const stale = { ...valid, providerId: 'stale', retrievedAt: '2026-08-30T20:00:00Z', candidates: [{ ...valid.candidates[0]!, id: 's1', provenance: [{ provider: 'stale', retrievedAt: '2026-08-30T20:00:00Z', licenseClass: 'licensed' as const }] }] };
  assert.throws(() => mergeCertifiedPartsFeeds([valid, stale], { currency: 'USD', maximumAgeMinutes: 15 }, { nowMs: now }), /parts_feed_certification_failed/);
});

test('explicit partial mode excludes invalid providers instead of mixing their data', () => {
  const valid = { providerId: 'feed', retrievedAt: '2026-08-31T01:55:00Z', candidates: [{ id: 'a1', description: 'Bumper', sourceType: 'new_oem' as const, partNumber: 'ABC-123', price: { amountMinor: 50000, currency: 'USD' }, provenance }] };
  const invalid = { providerId: 'bad', retrievedAt: '2026-08-31T01:55:00Z', candidates: [{ id: 'b1', description: 'Bumper', sourceType: 'new_oem' as const, partNumber: 'ABC-123', price: { amountMinor: 100, currency: 'USD' }, provenance: [] }] };
  const result = mergeCertifiedPartsFeeds([valid, invalid], { currency: 'USD', maximumAgeMinutes: 15 }, { nowMs: now, failClosed: false });
  assert.deepEqual(result.providers, ['feed']);
  assert.deepEqual(result.candidates.map(candidate => candidate.id), ['a1']);
  assert.equal(result.rejectedProviders[0]?.providerId, 'bad');
});
