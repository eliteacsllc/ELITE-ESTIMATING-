import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export type LifecycleTopic =
  | 'estimate.created'
  | 'estimate.lines_updated'
  | 'estimate.approved'
  | 'estimate.voided'
  | 'supplement.created'
  | 'supplement.updated'
  | 'supplement.submitted'
  | 'supplement.approved';

export type LifecycleEvent = {
  id: string;
  tenantId: string;
  topic: LifecycleTopic;
  aggregateType: 'estimate' | 'supplement';
  aggregateId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  occurredAt: string;
};

export type PendingLifecycleEvent = LifecycleEvent & {
  attempts: number;
  lastError?: string;
};

export type LifecycleOutboxHealth = {
  unpublishedTotal: number;
  pendingTotal: number;
  retriedTotal: number;
  exhaustedTotal: number;
  oldestPendingSeconds: number;
};

export interface LifecycleSink {
  emit(event: LifecycleEvent): Promise<void>;
}

export interface LifecycleOutboxHealthSource {
  healthSnapshot(maxAttempts?: number): Promise<LifecycleOutboxHealth>;
}

export function lifecycleEvent(input: Omit<LifecycleEvent, 'id' | 'occurredAt'>): LifecycleEvent {
  return { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
}

export class NoopLifecycleSink implements LifecycleSink {
  async emit(): Promise<void> {}
}

export class MemoryLifecycleSink implements LifecycleSink, LifecycleOutboxHealthSource {
  readonly events: LifecycleEvent[] = [];
  async emit(event: LifecycleEvent): Promise<void> {
    if (!this.events.some(row => row.idempotencyKey === event.idempotencyKey)) this.events.push(structuredClone(event));
  }
  async healthSnapshot(): Promise<LifecycleOutboxHealth> {
    if (!this.events.length) return { unpublishedTotal: 0, pendingTotal: 0, retriedTotal: 0, exhaustedTotal: 0, oldestPendingSeconds: 0 };
    const oldest = Math.min(...this.events.map(event => Date.parse(event.occurredAt)));
    return {
      unpublishedTotal: this.events.length,
      pendingTotal: this.events.length,
      retriedTotal: 0,
      exhaustedTotal: 0,
      oldestPendingSeconds: Math.max(0, (Date.now() - oldest) / 1000),
    };
  }
}

export class PostgresLifecycleOutbox implements LifecycleSink, LifecycleOutboxHealthSource {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async emit(event: LifecycleEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO integration_outbox
       (id,tenant_id,topic,aggregate_type,aggregate_id,payload,idempotency_key,occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [event.id, event.tenantId, event.topic, event.aggregateType, event.aggregateId, JSON.stringify(event.payload), event.idempotencyKey, event.occurredAt],
    );
  }

  async pending(limit = 50, maxAttempts = 10): Promise<PendingLifecycleEvent[]> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    const safeAttempts = Math.max(1, Math.min(Math.trunc(maxAttempts), 100));
    const result = await this.pool.query(
      `SELECT id, tenant_id, topic, aggregate_type, aggregate_id, payload, idempotency_key, occurred_at, attempts, last_error
       FROM integration_outbox
       WHERE published_at IS NULL AND attempts < $1
       ORDER BY occurred_at ASC
       LIMIT $2`,
      [safeAttempts, safeLimit],
    );
    return result.rows.map(row => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      topic: row.topic as LifecycleTopic,
      aggregateType: row.aggregate_type as 'estimate' | 'supplement',
      aggregateId: String(row.aggregate_id),
      payload: row.payload as Record<string, unknown>,
      idempotencyKey: String(row.idempotency_key),
      occurredAt: new Date(row.occurred_at as string | Date).toISOString(),
      attempts: Number(row.attempts),
      ...(row.last_error ? { lastError: String(row.last_error) } : {}),
    }));
  }

  async healthSnapshot(maxAttempts = 10): Promise<LifecycleOutboxHealth> {
    const safeAttempts = Math.max(1, Math.min(Math.trunc(maxAttempts), 100));
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE published_at IS NULL)::int AS unpublished_total,
         COUNT(*) FILTER (WHERE published_at IS NULL AND attempts < $1)::int AS pending_total,
         COUNT(*) FILTER (WHERE published_at IS NULL AND attempts > 0 AND attempts < $1)::int AS retried_total,
         COUNT(*) FILTER (WHERE published_at IS NULL AND attempts >= $1)::int AS exhausted_total,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(occurred_at) FILTER (WHERE published_at IS NULL AND attempts < $1))), 0)::double precision AS oldest_pending_seconds
       FROM integration_outbox`,
      [safeAttempts],
    );
    const row = result.rows[0] ?? {};
    return {
      unpublishedTotal: Number(row.unpublished_total ?? 0),
      pendingTotal: Number(row.pending_total ?? 0),
      retriedTotal: Number(row.retried_total ?? 0),
      exhaustedTotal: Number(row.exhausted_total ?? 0),
      oldestPendingSeconds: Math.max(0, Number(row.oldest_pending_seconds ?? 0)),
    };
  }

  async markPublished(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE integration_outbox SET published_at=NOW(), last_error=NULL WHERE id=$1 AND published_at IS NULL',
      [id],
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.pool.query(
      'UPDATE integration_outbox SET attempts=attempts+1, last_error=$2 WHERE id=$1 AND published_at IS NULL',
      [id, error.slice(0, 2000)],
    );
  }

  async close(): Promise<void> { await this.pool.end(); }
}
