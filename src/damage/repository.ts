import { Pool } from 'pg';
import type { DamageGraph } from './graph.js';

export interface DamageGraphRepository {
  save(tenantId: string, graph: DamageGraph): Promise<DamageGraph>;
  get(tenantId: string, estimateId: string, revision: number): Promise<DamageGraph | null>;
  getLatest(tenantId: string, estimateId: string): Promise<DamageGraph | null>;
}

export class InMemoryDamageGraphRepository implements DamageGraphRepository {
  private readonly rows = new Map<string, DamageGraph>();

  private key(tenantId: string, estimateId: string, revision: number): string {
    return `${tenantId}:${estimateId}:${revision}`;
  }

  async save(tenantId: string, graph: DamageGraph): Promise<DamageGraph> {
    this.rows.set(this.key(tenantId, graph.estimateId, graph.revision), structuredClone(graph));
    return structuredClone(graph);
  }

  async get(tenantId: string, estimateId: string, revision: number): Promise<DamageGraph | null> {
    const graph = this.rows.get(this.key(tenantId, estimateId, revision));
    return graph ? structuredClone(graph) : null;
  }

  async getLatest(tenantId: string, estimateId: string): Promise<DamageGraph | null> {
    const prefix = `${tenantId}:${estimateId}:`;
    const rows = [...this.rows.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, graph]) => graph)
      .sort((a, b) => b.revision - a.revision);
    return rows[0] ? structuredClone(rows[0]) : null;
  }
}

export class PostgresDamageGraphRepository implements DamageGraphRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async save(tenantId: string, graph: DamageGraph): Promise<DamageGraph> {
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO estimate_damage_graphs (tenant_id,estimate_id,revision,graph,created_at,updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$5)
       ON CONFLICT (tenant_id,estimate_id,revision)
       DO UPDATE SET graph=EXCLUDED.graph, updated_at=EXCLUDED.updated_at`,
      [tenantId, graph.estimateId, graph.revision, JSON.stringify(graph), now],
    );
    return structuredClone(graph);
  }

  async get(tenantId: string, estimateId: string, revision: number): Promise<DamageGraph | null> {
    const result = await this.pool.query(
      'SELECT graph FROM estimate_damage_graphs WHERE tenant_id=$1 AND estimate_id=$2 AND revision=$3 LIMIT 1',
      [tenantId, estimateId, revision],
    );
    return result.rowCount ? (result.rows[0]!.graph as DamageGraph) : null;
  }

  async getLatest(tenantId: string, estimateId: string): Promise<DamageGraph | null> {
    const result = await this.pool.query(
      'SELECT graph FROM estimate_damage_graphs WHERE tenant_id=$1 AND estimate_id=$2 ORDER BY revision DESC LIMIT 1',
      [tenantId, estimateId],
    );
    return result.rowCount ? (result.rows[0]!.graph as DamageGraph) : null;
  }

  async health(): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
