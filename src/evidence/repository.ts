import { Pool } from 'pg';
import type { EvidenceAsset } from './types.js';

export interface EvidenceRepository {
  create(asset: EvidenceAsset): Promise<EvidenceAsset>;
  getById(tenantId: string, id: string): Promise<EvidenceAsset | null>;
  getBySource(tenantId: string, estimateId: string, sourceSystem: string, sourceAssetId: string): Promise<EvidenceAsset | null>;
  listByEstimate(tenantId: string, estimateId: string): Promise<EvidenceAsset[]>;
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly rows = new Map<string, EvidenceAsset>();
  async create(asset: EvidenceAsset): Promise<EvidenceAsset> {
    const duplicate = await this.getBySource(asset.tenantId, asset.estimateId, asset.sourceSystem, asset.sourceAssetId);
    if (duplicate) throw new Error('evidence_source_already_registered');
    this.rows.set(`${asset.tenantId}:${asset.id}`, structuredClone(asset));
    return structuredClone(asset);
  }
  async getById(tenantId: string, id: string): Promise<EvidenceAsset | null> {
    const row = this.rows.get(`${tenantId}:${id}`);
    return row ? structuredClone(row) : null;
  }
  async getBySource(tenantId: string, estimateId: string, sourceSystem: string, sourceAssetId: string): Promise<EvidenceAsset | null> {
    const row = [...this.rows.values()].find(item => item.tenantId === tenantId && item.estimateId === estimateId && item.sourceSystem === sourceSystem && item.sourceAssetId === sourceAssetId);
    return row ? structuredClone(row) : null;
  }
  async listByEstimate(tenantId: string, estimateId: string): Promise<EvidenceAsset[]> {
    return [...this.rows.values()].filter(row => row.tenantId === tenantId && row.estimateId === estimateId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(row => structuredClone(row));
  }
}

export class PostgresEvidenceRepository implements EvidenceRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  async create(asset: EvidenceAsset): Promise<EvidenceAsset> {
    try {
      await this.pool.query(
        `INSERT INTO estimate_evidence
         (tenant_id,id,estimate_id,source_system,source_asset_id,kind,mime_type,sha256,storage_key,captured_at,metadata,provenance,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)`,
        [asset.tenantId,asset.id,asset.estimateId,asset.sourceSystem,asset.sourceAssetId,asset.kind,asset.mimeType,asset.sha256,asset.storageKey,asset.capturedAt ?? null,JSON.stringify(asset.metadata),JSON.stringify(asset.provenance),asset.createdAt],
      );
      return structuredClone(asset);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as Error & {code?: string}).code === '23505') throw new Error('evidence_source_already_registered');
      throw error;
    }
  }
  private mapRow(row: Record<string, unknown>): EvidenceAsset {
    return {
      tenantId:String(row.tenant_id), id:String(row.id), estimateId:String(row.estimate_id), sourceSystem:String(row.source_system), sourceAssetId:String(row.source_asset_id),
      kind:row.kind as EvidenceAsset['kind'], mimeType:String(row.mime_type), sha256:String(row.sha256), storageKey:String(row.storage_key),
      ...(row.captured_at ? { capturedAt:new Date(row.captured_at as string|Date).toISOString() } : {}), metadata:row.metadata as Record<string,unknown>, provenance:row.provenance as EvidenceAsset['provenance'], createdAt:new Date(row.created_at as string|Date).toISOString(),
    };
  }
  async getById(tenantId: string, id: string): Promise<EvidenceAsset | null> {
    const result = await this.pool.query(
      `SELECT tenant_id,id,estimate_id,source_system,source_asset_id,kind,mime_type,sha256,storage_key,captured_at,metadata,provenance,created_at
       FROM estimate_evidence WHERE tenant_id=$1 AND id=$2 LIMIT 1`,
      [tenantId, id],
    );
    return result.rowCount ? this.mapRow(result.rows[0] as Record<string, unknown>) : null;
  }
  async getBySource(tenantId: string, estimateId: string, sourceSystem: string, sourceAssetId: string): Promise<EvidenceAsset | null> {
    const result = await this.pool.query(
      `SELECT tenant_id,id,estimate_id,source_system,source_asset_id,kind,mime_type,sha256,storage_key,captured_at,metadata,provenance,created_at
       FROM estimate_evidence
       WHERE tenant_id=$1 AND estimate_id=$2 AND source_system=$3 AND source_asset_id=$4 LIMIT 1`,
      [tenantId, estimateId, sourceSystem, sourceAssetId],
    );
    return result.rowCount ? this.mapRow(result.rows[0] as Record<string, unknown>) : null;
  }
  async listByEstimate(tenantId: string, estimateId: string): Promise<EvidenceAsset[]> {
    const result = await this.pool.query(
      `SELECT tenant_id,id,estimate_id,source_system,source_asset_id,kind,mime_type,sha256,storage_key,captured_at,metadata,provenance,created_at
       FROM estimate_evidence WHERE tenant_id=$1 AND estimate_id=$2 ORDER BY created_at DESC`,
      [tenantId, estimateId],
    );
    return result.rows.map(row => this.mapRow(row as Record<string, unknown>));
  }
  async close(): Promise<void> { await this.pool.end(); }
}
