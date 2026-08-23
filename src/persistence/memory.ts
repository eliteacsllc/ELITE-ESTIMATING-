import type { Estimate } from '../domain/types.js';
import type { EstimateRepository } from './repository.js';

export class InMemoryEstimateRepository implements EstimateRepository {
  private readonly rows = new Map<string, Estimate>();

  private key(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  async create(estimate: Estimate): Promise<Estimate> {
    const key = this.key(estimate.tenantId, estimate.id);
    if (this.rows.has(key)) throw new Error('estimate_already_exists');
    this.rows.set(key, structuredClone(estimate));
    return structuredClone(estimate);
  }

  async getById(tenantId: string, id: string): Promise<Estimate | null> {
    const value = this.rows.get(this.key(tenantId, id));
    return value ? structuredClone(value) : null;
  }

  async save(estimate: Estimate): Promise<Estimate> {
    const key = this.key(estimate.tenantId, estimate.id);
    if (!this.rows.has(key)) throw new Error('estimate_not_found');
    this.rows.set(key, structuredClone(estimate));
    return structuredClone(estimate);
  }

  async listByClaim(tenantId: string, claimId: string): Promise<Estimate[]> {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId && row.claimId === claimId)
      .map((row) => structuredClone(row));
  }
}
