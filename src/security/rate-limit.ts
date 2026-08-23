import { createHash } from 'node:crypto';
import { Pool } from 'pg';
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

export interface RateLimiter {
  consume(key: string, cost?: number): RateLimitResult | Promise<RateLimitResult>;
  health?(): Promise<boolean>;
  close?(): Promise<void>;
}

type Bucket = { tokens: number; updatedAt: number; lastSeenAt: number };

export function principalRateLimitKey(principal: Principal): string {
  return createHash('sha256').update(`${principal.tenantId}:${principal.userId}`).digest('hex').slice(0, 32);
}

function validatePolicy(policy: RateLimitPolicy): void {
  if (!Number.isSafeInteger(policy.capacity) || policy.capacity < 1) throw new Error('invalid_rate_limit_capacity');
  if (!Number.isFinite(policy.refillPerSecond) || policy.refillPerSecond <= 0) throw new Error('invalid_rate_limit_refill');
  if (!Number.isSafeInteger(policy.maxBuckets) || policy.maxBuckets < 10) throw new Error('invalid_rate_limit_max_buckets');
  if (!Number.isSafeInteger(policy.idleTtlMs) || policy.idleTtlMs < 1000) throw new Error('invalid_rate_limit_idle_ttl');
}

function validateCost(cost: number, capacity: number): void {
  if (!Number.isFinite(cost) || cost <= 0 || cost > capacity) throw new Error('invalid_rate_limit_cost');
}

function resultFor(tokens: number, allowed: boolean, cost: number, refillPerSecond: number): RateLimitResult {
  const deficit = allowed ? 0 : cost - tokens;
  return {
    allowed,
    remaining: Math.max(0, Math.floor(tokens)),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(deficit / refillPerSecond)),
  };
}

export class InMemoryTokenBucketRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly policy: RateLimitPolicy) { validatePolicy(policy); }

  consume(key: string, cost = 1, now = Date.now()): RateLimitResult {
    validateCost(cost, this.policy.capacity);
    this.sweep(now);
    const existing = this.buckets.get(key) ?? { tokens: this.policy.capacity, updatedAt: now, lastSeenAt: now };
    const elapsedSeconds = Math.max(0, now - existing.updatedAt) / 1000;
    const available = Math.min(this.policy.capacity, existing.tokens + elapsedSeconds * this.policy.refillPerSecond);
    const allowed = available >= cost;
    const tokens = allowed ? available - cost : available;
    this.buckets.set(key, { tokens, updatedAt: now, lastSeenAt: now });
    return resultFor(tokens, allowed, cost, this.policy.refillPerSecond);
  }

  async health(): Promise<boolean> { return true; }

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

export class PostgresTokenBucketRateLimiter implements RateLimiter {
  private readonly pool: Pool;

  constructor(connectionString: string, private readonly policy: RateLimitPolicy) {
    validatePolicy(policy);
    this.pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async consume(key: string, cost = 1): Promise<RateLimitResult> {
    validateCost(cost, this.policy.capacity);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO rate_limit_buckets (bucket_key,tokens,updated_at,last_seen_at)
         VALUES ($1,$2,clock_timestamp(),clock_timestamp()) ON CONFLICT (bucket_key) DO NOTHING`,
        [key, this.policy.capacity],
      );
      const current = await client.query(
        `SELECT tokens, EXTRACT(EPOCH FROM (clock_timestamp() - updated_at)) AS elapsed_seconds
         FROM rate_limit_buckets WHERE bucket_key=$1 FOR UPDATE`,
        [key],
      );
      if (current.rowCount !== 1) throw new Error('rate_limit_bucket_resolution_failed');
      const storedTokens = Number(current.rows[0]!.tokens);
      const elapsedSeconds = Math.max(0, Number(current.rows[0]!.elapsed_seconds));
      const available = Math.min(this.policy.capacity, storedTokens + elapsedSeconds * this.policy.refillPerSecond);
      const allowed = available >= cost;
      const tokens = allowed ? available - cost : available;
      await client.query(
        `UPDATE rate_limit_buckets SET tokens=$2,updated_at=clock_timestamp(),last_seen_at=clock_timestamp() WHERE bucket_key=$1`,
        [key, tokens],
      );
      await client.query('COMMIT');
      return resultFor(tokens, allowed, cost, this.policy.refillPerSecond);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async health(): Promise<boolean> {
    const result = await this.pool.query("SELECT to_regclass('public.rate_limit_buckets') IS NOT NULL AS ok");
    return result.rows[0]?.ok === true;
  }

  async purgeIdle(): Promise<number> {
    const result = await this.pool.query('DELETE FROM rate_limit_buckets WHERE last_seen_at < NOW() - ($1::bigint * interval \'1 millisecond\')', [this.policy.idleTtlMs]);
    return result.rowCount ?? 0;
  }

  async close(): Promise<void> { await this.pool.end(); }
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
