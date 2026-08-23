import { createHash } from 'node:crypto';
import { Pool } from 'pg';

export type IdempotencyReceipt = {
  tenantId: string;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  resourceId: string;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
};

export type ClaimIdempotencyInput = Omit<IdempotencyReceipt, 'createdAt' | 'expiresAt' | 'completedAt'> & {
  ttlSeconds?: number;
};

export interface IdempotencyRepository {
  claim(input: ClaimIdempotencyInput): Promise<{ receipt: IdempotencyReceipt; created: boolean }>;
  complete(tenantId: string, operation: string, idempotencyKey: string): Promise<void>;
  health?(): Promise<boolean>;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('idempotency_request_non_finite_number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  throw new Error('idempotency_request_unsupported_value');
}

export function hashIdempotencyRequest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function validateIdempotencyKey(value: string): string {
  const key = value.trim();
  if (key.length < 8 || key.length > 200) throw new Error('invalid_idempotency_key');
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) throw new Error('invalid_idempotency_key');
  return key;
}

export function deterministicIdempotentResourceId(tenantId: string, operation: string, key: string): string {
  const bytes = Buffer.from(createHash('sha256').update(`${tenantId}:${operation}:${key}`).digest().subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildReceipt(input: ClaimIdempotencyInput): IdempotencyReceipt {
  const now = new Date();
  const ttlSeconds = Math.min(Math.max(Math.trunc(input.ttlSeconds ?? 604800), 60), 2_592_000);
  return {
    tenantId: input.tenantId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    resourceId: input.resourceId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };
}

export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly rows = new Map<string, IdempotencyReceipt>();
  private key(tenantId: string, operation: string, idempotencyKey: string): string { return `${tenantId}:${operation}:${idempotencyKey}`; }
  async claim(input: ClaimIdempotencyInput): Promise<{ receipt: IdempotencyReceipt; created: boolean }> {
    const key = this.key(input.tenantId, input.operation, input.idempotencyKey);
    const existing = this.rows.get(key);
    if (existing && Date.parse(existing.expiresAt) > Date.now()) return { receipt: structuredClone(existing), created: false };
    const receipt = buildReceipt(input);
    this.rows.set(key, structuredClone(receipt));
    return { receipt, created: true };
  }
  async complete(tenantId: string, operation: string, idempotencyKey: string): Promise<void> {
    const key = this.key(tenantId, operation, idempotencyKey);
    const existing = this.rows.get(key);
    if (!existing) throw new Error('idempotency_receipt_not_found');
    this.rows.set(key, { ...existing, completedAt: existing.completedAt ?? new Date().toISOString() });
  }
  async health(): Promise<boolean> { return true; }
}

export class PostgresIdempotencyRepository implements IdempotencyRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  private mapRow(row: Record<string, unknown>): IdempotencyReceipt {
    return {
      tenantId: String(row.tenant_id), operation: String(row.operation), idempotencyKey: String(row.idempotency_key), requestHash: String(row.request_hash), resourceId: String(row.resource_id),
      createdAt: new Date(row.created_at as string | Date).toISOString(), expiresAt: new Date(row.expires_at as string | Date).toISOString(),
      ...(row.completed_at ? { completedAt: new Date(row.completed_at as string | Date).toISOString() } : {}),
    };
  }
  async claim(input: ClaimIdempotencyInput): Promise<{ receipt: IdempotencyReceipt; created: boolean }> {
    const receipt = buildReceipt(input);
    const claimed = await this.pool.query(
      `INSERT INTO mutation_idempotency_receipts
       (tenant_id,operation,idempotency_key,request_hash,resource_id,created_at,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id,operation,idempotency_key)
       DO UPDATE SET request_hash=EXCLUDED.request_hash, resource_id=EXCLUDED.resource_id,
                     completed_at=NULL, created_at=EXCLUDED.created_at, expires_at=EXCLUDED.expires_at
       WHERE mutation_idempotency_receipts.expires_at <= NOW()
       RETURNING tenant_id,operation,idempotency_key,request_hash,resource_id,created_at,expires_at,completed_at`,
      [receipt.tenantId, receipt.operation, receipt.idempotencyKey, receipt.requestHash, receipt.resourceId, receipt.createdAt, receipt.expiresAt],
    );
    if (claimed.rowCount) {
      const row = this.mapRow(claimed.rows[0] as Record<string, unknown>);
      return { receipt: row, created: row.createdAt === receipt.createdAt };
    }
    const existing = await this.pool.query(
      `SELECT tenant_id,operation,idempotency_key,request_hash,resource_id,created_at,expires_at,completed_at
       FROM mutation_idempotency_receipts WHERE tenant_id=$1 AND operation=$2 AND idempotency_key=$3 LIMIT 1`,
      [input.tenantId, input.operation, input.idempotencyKey],
    );
    if (!existing.rowCount) throw new Error('idempotency_claim_resolution_failed');
    return { receipt: this.mapRow(existing.rows[0] as Record<string, unknown>), created: false };
  }
  async complete(tenantId: string, operation: string, idempotencyKey: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE mutation_idempotency_receipts SET completed_at=COALESCE(completed_at,NOW())
       WHERE tenant_id=$1 AND operation=$2 AND idempotency_key=$3`,
      [tenantId, operation, idempotencyKey],
    );
    if (result.rowCount !== 1) throw new Error('idempotency_receipt_not_found');
  }
  async health(): Promise<boolean> {
    const result = await this.pool.query("SELECT to_regclass('public.mutation_idempotency_receipts') IS NOT NULL AS ok");
    return result.rows[0]?.ok === true;
  }
  async close(): Promise<void> { await this.pool.end(); }
}
