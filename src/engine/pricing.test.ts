import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrices } from './pricing.js';

const source = (provider: string, amountMinor: number) => ({
  price: { amountMinor, currency: 'USD' },
  observedAt: '2026-08-23T00:00:00Z',
  provenance: { provider, retrievedAt: '2026-08-23T00:00:00Z', licenseClass: 'licensed' as const },
});

test('normalizes multiple sources and limits extreme outliers', () => {
  const normalized = normalizePrices([
    source('a', 10000), source('b', 10100), source('c', 9900), source('d', 1000000),
  ]);
  assert.ok(normalized.price.amountMinor < 20000);
  assert.ok(normalized.confidence > 0.5);
});

test('rejects mixed currency normalization', () => {
  assert.throws(() => normalizePrices([
    source('a', 10000),
    { ...source('b', 11000), price: { amountMinor: 11000, currency: 'EUR' } },
  ]), /pricing_currency_mismatch/);
});
