import { createHash } from 'node:crypto';
import type { Principal } from './rbac.js';

export type RateLimitPolicy = {
  capacity: number;
  refillPerSecond: number;
  maxBuckets: number;
  idleTtlMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = { tokens: number; updatedAt: number; lastSeenAt: number };

export function principalRateLimitKey(principal: Principal): string {
  return createHash('sha256').update(`${principal.tenantId}:${principal.userId}`).digest('hex').slice(0, 32);
}

export class InMemoryTokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly policy: RateLimitPolicy) {
    if (!Number.isSafeInteger(policy.capacity) || policy.capacity < 1) throw new Error('invalid_rate_limit_capacity');
    if (!Number.isFinite(policy.refillPerSecond) || policy.refillPerSecond <= 0) throw new Error('invalid_rate_limit_refill');
    if (!Number.isSafeInteger(policy.maxBuckets) || policy.maxBuckets < 10) throw new Error('invalid_rate_limit_max_buckets');
    if (!Number.isSafeInteger(policy.idleTtlMs) || policy.idleTtlMs < 1000) throw new Error('invalid_rate_limit_idle_ttl');
  }

  consume(key: string, cost = 1, now = Date.now()): RateLimitResult {
    if (!Number.isFinite(cost) || cost <= 0 || cost > this.policy.capacity) throw new Error('invalid_rate_limit_cost');
    this.sweep(now);
    const existing = this.buckets.get(key) ?? { tokens: this.policy.capacity, updatedAt: now, lastSeenAt: now };
    const elapsedSeconds = Math.max(0, now - existing.updatedAt) / 1000;
    const available = Math.min(this.policy.capacity, existing.tokens + elapsedSeconds * this.policy.refillPerSecond);
    const allowed = available >= cost;
    const tokens = allowed ? available - cost : available;
    this.buckets.set(key, { tokens, updatedAt: now, lastSeenAt: now });
    const deficit = allowed ? 0 : cost - tokens;
    return {
      allowed,
      remaining: Math.max(0, Math.floor(tokens)),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(deficit / this.policy.refillPerSecond)),
    };
  }

  private sweep(now: number): void {
    if (this.buckets.size < this.policy.maxBuckets) return;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastSeenAt > this.policy.idleTtlMs) this.buckets.delete(key);
      if (this.buckets.size < this.policy.maxBuckets) return;
    }
    const oldest = [...this.buckets.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)[0];
    if (oldest) this.buckets.delete(oldest[0]);
  }
}

function requiredPositiveNumber(value: string | undefined, name: string): number {
  if (!value?.trim()) throw new Error(`missing_${name}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`invalid_${name}`);
  return parsed;
}

export function rateLimitPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): RateLimitPolicy | null {
  const capacityRaw = env.ELITE_RATE_LIMIT_CAPACITY?.trim();
  const refillRaw = env.ELITE_RATE_LIMIT_REFILL_PER_SECOND?.trim();
  if (!capacityRaw && !refillRaw) return null;
  const capacity = requiredPositiveNumber(capacityRaw, 'rate_limit_capacity');
  const refillPerSecond = requiredPositiveNumber(refillRaw, 'rate_limit_refill_per_second');
  if (!Number.isSafeInteger(capacity)) throw new Error('invalid_rate_limit_capacity');
  return { capacity, refillPerSecond, maxBuckets: 100_000, idleTtlMs: 15 * 60_000 };
}
