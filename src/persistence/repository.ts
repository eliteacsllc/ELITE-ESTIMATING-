import type { Estimate } from '../domain/types.js';

export interface EstimateRepository {
  create(estimate: Estimate): Promise<Estimate>;
  getById(tenantId: string, id: string): Promise<Estimate | null>;
  save(estimate: Estimate): Promise<Estimate>;
  listByClaim(tenantId: string, claimId: string): Promise<Estimate[]>;
}
