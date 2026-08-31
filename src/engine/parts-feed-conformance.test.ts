import assert from 'node:assert/strict';
import test from 'node:test';
import type { PartsFeed } from './parts-exchange.js';
import { certifyPartsFeed } from './parts-feed-conformance.js';

const now = Date.parse('2026-08-31T02:00:00Z');
const feed: PartsFeed = {
  providerId: 'supplier-a',
  retrievedAt: '2026-08-31T01:55:00Z',
  candidates: [{
    id: 'part-1', description: 'Front door shell', sourceType: 'new_oem', partNumber: 'ABC-123',
    price: { amountMinor: 65000, currency: 'USD' }, quantityAvailable: 3, leadTimeDays: 1,
    provenance: [{ provider: 'supplier-a', retrievedAt: '2026-08-31T01:55:00Z', licenseClass: 'licensed' }],
  }],
};

test('fresh provider-matched feed certifies green', () => {
  const result = certifyPartsFeed(feed, { currency: 'USD', maximumAgeMinutes: 15, requireAvailabilityTimestamp: true }, now);
  assert.equal(result.green, true, result.blockers.join(','));
  assert.equal(result.candidateCount, 1);
});

test('stale quote feed is blocked', () => {
  const result = certifyPartsFeed({ ...feed, retrievedAt: '2026-08-30T20:00:00Z' }, { currency: 'USD', maximumAgeMinutes: 15 }, now);
  assert.equal(result.green, false);
  assert.ok(result.blockers.some(item => item.startsWith('parts_feed_stale:')));
});

test('candidate must retain provenance from its supplying feed', () => {
  const result = certifyPartsFeed({ ...feed, candidates: [{ ...feed.candidates[0]!, provenance: [{ provider: 'other', retrievedAt: '2026-08-31T01:55:00Z', licenseClass: 'licensed' }] }] }, { currency: 'USD', maximumAgeMinutes: 15 }, now);
  assert.equal(result.green, false);
  assert.ok(result.blockers.includes('parts_provider_provenance_mismatch:part-1'));
});
