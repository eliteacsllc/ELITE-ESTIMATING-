import { Pool } from 'pg';
import type { Estimate } from '../domain/types.js';
import type { EstimateRepository } from './repository.js';

export class PostgresEstimateRepository implements EstimateRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async health(): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async create(estimate: Estimate): Promise<Estimate> {
    await this.pool.query(
      `INSERT INTO estimates
       (tenant_id,id,claim_id,revision,status,asset_class,jurisdiction,currency,payload,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
      [
        estimate.tenantId, estimate.id, estimate.claimId ?? null, estimate.revision, estimate.status,
        estimate.asset.assetClass, estimate.jurisdiction, estimate.currency, JSON.stringify(estimate),
        estimate.createdAt, estimate.updatedAt,
      ],
    );
    return structuredClone(estimate);
  }

  async getById(tenantId: string, id: string): Promise<Estimate | null> {
    const result = await this.pool.query(
      'SELECT payload FROM estimates WHERE tenant_id = $1 AND id = $2 LIMIT 1',
      [tenantId, id],
    );
    return result.rowCount ? (result.rows[0]!.payload as Estimate) : null;
  }

  async save(estimate: Estimate): Promise<Estimate> {
    const result = await this.pool.query(
      `UPDATE estimates SET
        claim_id=$3, revision=$4, status=$5, asset_class=$6, jurisdiction=$7, currency=$8,
        payload=$9::jsonb, updated_at=$10
       WHERE tenant_id=$1 AND id=$2`,
      [
        estimate.tenantId, estimate.id, estimate.claimId ?? null, estimate.revision, estimate.status,
        estimate.asset.assetClass, estimate.jurisdiction, estimate.currency, JSON.stringify(estimate), estimate.updatedAt,
      ],
    );
    if (result.rowCount !== 1) throw new Error('estimate_not_found');
    return structuredClone(estimate);
  }

  async listByClaim(tenantId: string, claimId: string): Promise<Estimate[]> {
    const result = await this.pool.query(
      'SELECT payload FROM estimates WHERE tenant_id=$1 AND claim_id=$2 ORDER BY updated_at DESC',
      [tenantId, claimId],
    );
    return result.rows.map((row) => row.payload as Estimate);
  }

  async listRecent(tenantId: string, limit: number): Promise<Estimate[]> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const result = await this.pool.query(
      'SELECT payload FROM estimates WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT $2',
      [tenantId, safeLimit],
    );
    return result.rows.map((row) => row.payload as Estimate);
  }
}
