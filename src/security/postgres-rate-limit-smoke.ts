import assert from 'node:assert/strict';
import { PostgresTokenBucketRateLimiter, type RateLimitPolicy } from './rate-limit.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const policy: RateLimitPolicy = { capacity: 4, refillPerSecond: 0.001, maxBuckets: 100, idleTtlMs: 60_000 };
const first = new PostgresTokenBucketRateLimiter(databaseUrl, policy);
const second = new PostgresTokenBucketRateLimiter(databaseUrl, policy);
const key = `distributed-smoke-${Date.now()}`;

try {
  const results = await Promise.all([
    first.consume(key), second.consume(key), first.consume(key), second.consume(key), first.consume(key), second.consume(key),
  ]);
  assert.equal(results.filter(result => result.allowed).length, 4, 'shared capacity must allow exactly four requests across limiter instances');
  assert.equal(results.filter(result => !result.allowed).length, 2, 'requests beyond shared capacity must be rejected');
  const after = await second.consume(key);
  assert.equal(after.allowed, false, 'a third limiter sequence must observe the already-consumed shared bucket');
  assert.equal(await first.health(), true);
  console.log('distributed PostgreSQL rate limiter smoke passed');
} finally {
  await first.close();
  await second.close();
}
