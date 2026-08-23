import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export type AuditEvent = {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export class NoopAuditSink implements AuditSink {
  async record(_event: AuditEvent): Promise<void> {}
}

export class PostgresAuditSink implements AuditSink {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async record(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events
       (id,tenant_id,actor_id,action,resource_type,resource_id,metadata,occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [event.id,event.tenantId,event.actorId,event.action,event.resourceType,event.resourceId,JSON.stringify(event.metadata),event.occurredAt],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function auditEvent(input: Omit<AuditEvent, 'id' | 'occurredAt'>): AuditEvent {
  return { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
}
