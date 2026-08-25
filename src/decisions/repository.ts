import { Pool } from 'pg';

export type DecisionType = 'parts_optimization' | 'repair_replace' | 'total_loss';

export type DecisionRecord = {
  tenantId: string;
  id: string;
  estimateId: string;
  estimateRevision: number;
  decisionType: DecisionType;
  inputHash: string;
  result: unknown;
  createdBy: string;
  createdAt: string;
};

export interface DecisionRecordRepository {
  create(record: DecisionRecord): Promise<{ record: DecisionRecord; created: boolean }>;
  listByEstimate(tenantId: string, estimateId: string, limit?: number): Promise<DecisionRecord[]>;
  health?(): Promise<boolean>;
  close?(): Promise<void>;
}

function sameNaturalKey(a: DecisionRecord, b: DecisionRecord): boolean {
  return a.tenantId === b.tenantId
    && a.estimateId === b.estimateId
    && a.estimateRevision === b.estimateRevision
    && a.decisionType === b.decisionType
    && a.inputHash === b.inputHash;
}

export class InMemoryDecisionRecordRepository implements DecisionRecordRepository {
  private readonly rows = new Map<string, DecisionRecord>();
  async create(record: DecisionRecord): Promise<{ record: DecisionRecord; created: boolean }> {
    const existing = [...this.rows.values()].find(row => sameNaturalKey(row, record));
    if (existing) return { record: structuredClone(existing), created: false };
    const key = `${record.tenantId}\u0000${record.id}`;
    if (this.rows.has(key)) throw new Error('decision_record_exists');
    this.rows.set(key, structuredClone(record));
    return { record: structuredClone(record), created: true };
  }
  async listByEstimate(tenantId: string, estimateId: string, limit = 100): Promise<DecisionRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    return [...this.rows.values()]
      .filter(row => row.tenantId === tenantId && row.estimateId === estimateId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, safeLimit)
      .map(row => structuredClone(row));
  }
}

export class PostgresDecisionRecordRepository implements DecisionRecordRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  async health(): Promise<boolean> {
    const result = await this.pool.query("SELECT to_regclass('public.estimate_decision_records') AS table_name");
    return result.rows[0]?.table_name === 'estimate_decision_records';
  }
  async close(): Promise<void> { await this.pool.end(); }
  async create(record: DecisionRecord): Promise<{ record: DecisionRecord; created: boolean }> {
    const inserted = await this.pool.query(
      `INSERT INTO estimate_decision_records
       (tenant_id,id,estimate_id,estimate_revision,decision_type,input_hash,result_json,created_by,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       ON CONFLICT (tenant_id,estimate_id,estimate_revision,decision_type,input_hash) DO NOTHING
       RETURNING tenant_id,id,estimate_id,estimate_revision,decision_type,input_hash,result_json,created_by,created_at`,
      [record.tenantId, record.id, record.estimateId, record.estimateRevision, record.decisionType, record.inputHash, JSON.stringify(record.result), record.createdBy, record.createdAt],
    );
    if (inserted.rowCount) return { record: this.fromRow(inserted.rows[0]!), created: true };
    const existing = await this.pool.query(
      `SELECT tenant_id,id,estimate_id,estimate_revision,decision_type,input_hash,result_json,created_by,created_at
       FROM estimate_decision_records
       WHERE tenant_id=$1 AND estimate_id=$2 AND estimate_revision=$3 AND decision_type=$4 AND input_hash=$5`,
      [record.tenantId, record.estimateId, record.estimateRevision, record.decisionType, record.inputHash],
    );
    if (!existing.rowCount) throw new Error('decision_replay_lookup_failed');
    return { record: this.fromRow(existing.rows[0]!), created: false };
  }
  async listByEstimate(tenantId: string, estimateId: string, limit = 100): Promise<DecisionRecord[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const result = await this.pool.query(
      `SELECT tenant_id,id,estimate_id,estimate_revision,decision_type,input_hash,result_json,created_by,created_at
       FROM estimate_decision_records WHERE tenant_id=$1 AND estimate_id=$2 ORDER BY created_at DESC LIMIT $3`,
      [tenantId, estimateId, safeLimit],
    );
    return result.rows.map(row => this.fromRow(row));
  }
  private fromRow(row: Record<string, unknown>): DecisionRecord {
    return {
      tenantId: String(row.tenant_id),
      id: String(row.id),
      estimateId: String(row.estimate_id),
      estimateRevision: Number(row.estimate_revision),
      decisionType: String(row.decision_type) as DecisionType,
      inputHash: String(row.input_hash),
      result: row.result_json,
      createdBy: String(row.created_by),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
    };
  }
}
