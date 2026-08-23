import { Pool } from 'pg';
import type { Supplement } from '../workflows/supplement.js';

export interface SupplementRepository {
  create(tenantId: string, supplement: Supplement): Promise<Supplement>;
  getById(tenantId: string, id: string): Promise<Supplement | null>;
  save(tenantId: string, supplement: Supplement): Promise<Supplement>;
  listByEstimate(tenantId: string, estimateId: string): Promise<Supplement[]>;
}

export class InMemorySupplementRepository implements SupplementRepository {
  private readonly rows = new Map<string, Supplement>();
  private key(tenantId: string, id: string): string { return `${tenantId}:${id}`; }

  async create(tenantId: string, supplement: Supplement): Promise<Supplement> {
    const key = this.key(tenantId, supplement.id);
    if (this.rows.has(key)) throw new Error('supplement_already_exists');
    this.rows.set(key, structuredClone(supplement));
    return structuredClone(supplement);
  }

  async getById(tenantId: string, id: string): Promise<Supplement | null> {
    const value = this.rows.get(this.key(tenantId, id));
    return value ? structuredClone(value) : null;
  }

  async save(tenantId: string, supplement: Supplement): Promise<Supplement> {
    const key = this.key(tenantId, supplement.id);
    if (!this.rows.has(key)) throw new Error('supplement_not_found');
    this.rows.set(key, structuredClone(supplement));
    return structuredClone(supplement);
  }

  async listByEstimate(tenantId: string, estimateId: string): Promise<Supplement[]> {
    return [...this.rows.entries()]
      .filter(([key, value]) => key.startsWith(`${tenantId}:`) && value.estimateId === estimateId)
      .map(([, value]) => structuredClone(value));
  }
}

export class PostgresSupplementRepository implements SupplementRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 6, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async create(tenantId: string, supplement: Supplement): Promise<Supplement> {
    try {
      await this.pool.query(
        `INSERT INTO supplements (tenant_id,id,estimate_id,base_revision,status,payload,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
        [tenantId,supplement.id,supplement.estimateId,supplement.baseRevision,supplement.status,JSON.stringify(supplement),supplement.createdAt],
      );
      return structuredClone(supplement);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as Error & { code?: string }).code === '23505') {
        throw new Error('supplement_already_exists');
      }
      throw error;
    }
  }

  async getById(tenantId: string, id: string): Promise<Supplement | null> {
    const result = await this.pool.query('SELECT payload FROM supplements WHERE tenant_id=$1 AND id=$2 LIMIT 1',[tenantId,id]);
    return result.rowCount ? result.rows[0]!.payload as Supplement : null;
  }

  async save(tenantId: string, supplement: Supplement): Promise<Supplement> {
    const result = await this.pool.query(
      `UPDATE supplements SET status=$3,payload=$4::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
      [tenantId,supplement.id,supplement.status,JSON.stringify(supplement)],
    );
    if (result.rowCount !== 1) throw new Error('supplement_not_found');
    return structuredClone(supplement);
  }

  async listByEstimate(tenantId: string, estimateId: string): Promise<Supplement[]> {
    const result = await this.pool.query('SELECT payload FROM supplements WHERE tenant_id=$1 AND estimate_id=$2 ORDER BY created_at DESC',[tenantId,estimateId]);
    return result.rows.map((row) => row.payload as Supplement);
  }

  async close(): Promise<void> { await this.pool.end(); }
}
