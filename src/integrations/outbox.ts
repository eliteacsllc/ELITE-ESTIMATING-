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
  async close(): Promise<void> { await this.pool.end(); }
}
