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

export interface LifecycleSink {
  emit(event: LifecycleEvent): Promise<void>;
}

export function lifecycleEvent(input: Omit<LifecycleEvent, 'id' | 'occurredAt'>): LifecycleEvent {
  return { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
}

export class NoopLifecycleSink implements LifecycleSink {
  async emit(): Promise<void> {}
}

export class MemoryLifecycleSink implements LifecycleSink {
  readonly events: LifecycleEvent[] = [];
  async emit(event: LifecycleEvent): Promise<void> {
    if (!this.events.some(row => row.idempotencyKey === event.idempotencyKey)) this.events.push(structuredClone(event));
  }
}

export class PostgresLifecycleOutbox implements LifecycleSink {
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
