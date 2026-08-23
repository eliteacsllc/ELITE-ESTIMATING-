import { Pool } from 'pg';

export type ImportReceipt = {
  tenantId: string;
  sourceSystem: string;
  sourceEstimateId: string;
  localEstimateId: string;
  importedAt: string;
};

export interface ImportReceiptRepository {
  get(tenantId: string, sourceSystem: string, sourceEstimateId: string): Promise<ImportReceipt | null>;
  save(receipt: ImportReceipt): Promise<ImportReceipt>;
}

export class InMemoryImportReceiptRepository implements ImportReceiptRepository {
  private readonly rows = new Map<string, ImportReceipt>();
  private key(tenantId: string, sourceSystem: string, sourceEstimateId: string): string {
    return `${tenantId}:${sourceSystem}:${sourceEstimateId}`;
  }
  async get(tenantId: string, sourceSystem: string, sourceEstimateId: string): Promise<ImportReceipt | null> {
    const row = this.rows.get(this.key(tenantId, sourceSystem, sourceEstimateId));
    return row ? structuredClone(row) : null;
  }
  async save(receipt: ImportReceipt): Promise<ImportReceipt> {
    const key = this.key(receipt.tenantId, receipt.sourceSystem, receipt.sourceEstimateId);
    const existing = this.rows.get(key);
    if (existing) return structuredClone(existing);
    this.rows.set(key, structuredClone(receipt));
    return structuredClone(receipt);
  }
}

export class PostgresImportReceiptRepository implements ImportReceiptRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  async get(tenantId: string, sourceSystem: string, sourceEstimateId: string): Promise<ImportReceipt | null> {
    const result = await this.pool.query(
      `SELECT tenant_id,source_system,source_estimate_id,local_estimate_id,imported_at
       FROM estimate_import_receipts
       WHERE tenant_id=$1 AND source_system=$2 AND source_estimate_id=$3 LIMIT 1`,
      [tenantId, sourceSystem, sourceEstimateId],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0]!;
    return {
      tenantId: String(row.tenant_id),
      sourceSystem: String(row.source_system),
      sourceEstimateId: String(row.source_estimate_id),
      localEstimateId: String(row.local_estimate_id),
      importedAt: new Date(row.imported_at).toISOString(),
    };
  }
  async save(receipt: ImportReceipt): Promise<ImportReceipt> {
    await this.pool.query(
      `INSERT INTO estimate_import_receipts
       (tenant_id,source_system,source_estimate_id,local_estimate_id,imported_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id,source_system,source_estimate_id) DO NOTHING`,
      [receipt.tenantId, receipt.sourceSystem, receipt.sourceEstimateId, receipt.localEstimateId, receipt.importedAt],
    );
    return (await this.get(receipt.tenantId, receipt.sourceSystem, receipt.sourceEstimateId)) ?? receipt;
  }
  async health(): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }
  async close(): Promise<void> { await this.pool.end(); }
}
