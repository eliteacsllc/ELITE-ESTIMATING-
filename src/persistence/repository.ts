import type { Estimate } from '../domain/types.js';

export interface EstimateRepository {
  create(estimate: Estimate): Promise<Estimate>;
  getById(tenantId: string, id: string): Promise<Estimate | null>;
  save(estimate: Estimate, expectedUpdatedAt?: string): Promise<Estimate>;
  listByClaim(tenantId: string, claimId: string): Promise<Estimate[]>;
  listRecent(tenantId: string, limit: number): Promise<Estimate[]>;
}
