import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryTokenBucketRateLimiter, principalRateLimitKey, rateLimitPolicyFromEnv } from './rate-limit.js';

test('token bucket rejects bursts and recovers through refill', () => {
  const limiter = new InMemoryTokenBucketRateLimiter({ capacity: 2, refillPerSecond: 1, maxBuckets: 10, idleTtlMs: 1000 });
  const now = 1_000_000;
  assert.equal(limiter.consume('k', 1, now).allowed, true);
  assert.equal(limiter.consume('k', 1, now).allowed, true);
  const blocked = limiter.consume('k', 1, now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.consume('k', 1, now + 1000).allowed, true);
});

test('principal keys are stable hashes without raw identity', () => {
  const key = principalRateLimitKey({ userId: 'user@example.com', tenantId: 'tenant-secret', roles: ['estimator'] });
  assert.equal(key.length, 32);
  assert.doesNotMatch(key, /user@example|tenant-secret/);
});

test('rate limiting remains disabled until both controls are configured', () => {
  assert.equal(rateLimitPolicyFromEnv({}), null);
  assert.throws(() => rateLimitPolicyFromEnv({ ELITE_RATE_LIMIT_CAPACITY: '100' }), /missing_rate_limit_refill_per_second/);
  assert.deepEqual(rateLimitPolicyFromEnv({ ELITE_RATE_LIMIT_CAPACITY: '120', ELITE_RATE_LIMIT_REFILL_PER_SECOND: '2' }), {
    capacity: 120, refillPerSecond: 2, maxBuckets: 100_000, idleTtlMs: 900_000,
  });
});
