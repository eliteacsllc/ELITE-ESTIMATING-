import test from 'node:test';
import assert from 'node:assert/strict';
import { searchComparablesWithExpansion, type ComparableProvider } from './provider.js';

const provider: ComparableProvider = {
  name: 'fixture-provider',
  async search(request) {
    const count = request.radiusMiles >= 100 ? 6 : request.radiusMiles >= 50 ? 3 : 1;
    return {
      provider: 'fixture-provider',
      searchedAt: '2026-09-16T00:00:00Z',
      radiusMiles: request.radiusMiles,
      comparables: Array.from({ length: count }, (_, i) => ({ id: `c${i}`, price: 20000 + i * 500 })),
    };
  },
};

test('expands provider search until target comp volume is reached', async () => {
  const result = await searchComparablesWithExpansion({
    provider,
    request: { subject: { year: 2022, make: 'Honda', model: 'Accord' } },
    initialRadiusMiles: 25,
    maxRadiusMiles: 200,
    targetCount: 6,
  });
  assert.deepEqual(result.attemptedRadii, [25, 50, 100]);
  assert.equal(result.comparables.length, 6);
  assert.equal(result.radiusMiles, 100);
});
