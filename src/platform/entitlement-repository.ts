import { Pool } from 'pg';
import type { AssetClass } from '../domain/types.js';
import type { AutomationLevel, FeatureId } from './features.js';

export type TenantFeatureProfile = {
  tenantId: string;
  assetClass: AssetClass;
  enabledFeatures: FeatureId[];
  automationLevel: AutomationLevel;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export interface TenantFeatureProfileRepository {
  get(tenantId: string, assetClass: AssetClass): Promise<TenantFeatureProfile | null>;
  list(tenantId: string): Promise<TenantFeatureProfile[]>;
  save(profile: TenantFeatureProfile): Promise<TenantFeatureProfile>;
  health?(): Promise<boolean>;
  close?(): Promise<void>;
}

export class InMemoryTenantFeatureProfileRepository implements TenantFeatureProfileRepository {
  private readonly rows = new Map<string, TenantFeatureProfile>();
  private key(tenantId: string, assetClass: AssetClass): string { return `${tenantId}\u0000${assetClass}`; }
  async get(tenantId: string, assetClass: AssetClass): Promise<TenantFeatureProfile | null> {
    const row = this.rows.get(this.key(tenantId, assetClass));
    return row ? structuredClone(row) : null;
  }
  async list(tenantId: string): Promise<TenantFeatureProfile[]> {
    return [...this.rows.values()].filter(row => row.tenantId === tenantId).sort((a, b) => a.assetClass.localeCompare(b.assetClass)).map(row => structuredClone(row));
  }
  async save(profile: TenantFeatureProfile): Promise<TenantFeatureProfile> {
    const existing = this.rows.get(this.key(profile.tenantId, profile.assetClass));
    const saved = { ...structuredClone(profile), createdAt: existing?.createdAt ?? profile.createdAt };
    this.rows.set(this.key(saved.tenantId, saved.assetClass), saved);
    return structuredClone(saved);
  }
}

export class PostgresTenantFeatureProfileRepository implements TenantFeatureProfileRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) { this.pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 }); }
  async health(): Promise<boolean> {
    const result = await this.pool.query("SELECT to_regclass('public.tenant_feature_profiles') AS table_name");
    return result.rows[0]?.table_name === 'tenant_feature_profiles';
  }
  async close(): Promise<void> { await this.pool.end(); }
  async get(tenantId: string, assetClass: AssetClass): Promise<TenantFeatureProfile | null> {
    const result = await this.pool.query('SELECT tenant_id,asset_class,enabled_features,automation_level,updated_by,created_at,updated_at FROM tenant_feature_profiles WHERE tenant_id=$1 AND asset_class=$2', [tenantId, assetClass]);
    return result.rowCount ? this.fromRow(result.rows[0]!) : null;
  }
  async list(tenantId: string): Promise<TenantFeatureProfile[]> {
    const result = await this.pool.query('SELECT tenant_id,asset_class,enabled_features,automation_level,updated_by,created_at,updated_at FROM tenant_feature_profiles WHERE tenant_id=$1 ORDER BY asset_class', [tenantId]);
    return result.rows.map(row => this.fromRow(row));
  }
  async save(profile: TenantFeatureProfile): Promise<TenantFeatureProfile> {
    const result = await this.pool.query(
      `INSERT INTO tenant_feature_profiles (tenant_id,asset_class,enabled_features,automation_level,updated_by,created_at,updated_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)
       ON CONFLICT (tenant_id,asset_class) DO UPDATE SET enabled_features=EXCLUDED.enabled_features,automation_level=EXCLUDED.automation_level,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at
       RETURNING tenant_id,asset_class,enabled_features,automation_level,updated_by,created_at,updated_at`,
      [profile.tenantId, profile.assetClass, JSON.stringify(profile.enabledFeatures), profile.automationLevel, profile.updatedBy, profile.createdAt, profile.updatedAt],
    );
    return this.fromRow(result.rows[0]!);
  }
  private fromRow(row: Record<string, unknown>): TenantFeatureProfile {
    return {
      tenantId: String(row.tenant_id),
      assetClass: String(row.asset_class) as AssetClass,
      enabledFeatures: row.enabled_features as FeatureId[],
      automationLevel: String(row.automation_level) as AutomationLevel,
      updatedBy: String(row.updated_by),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
      updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    };
  }
}
