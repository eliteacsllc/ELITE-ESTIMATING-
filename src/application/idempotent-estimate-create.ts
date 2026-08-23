import type { CreateEstimateInput, EstimatingService } from './estimating-service.js';
import type { Estimate } from '../domain/types.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { deterministicIdempotentResourceId, hashIdempotencyRequest, validateIdempotencyKey, type IdempotencyRepository } from '../api/idempotency.js';

export type IdempotentEstimateCreateInput = Omit<CreateEstimateInput, 'id' | 'tenantId'>;

export class IdempotentEstimateCreationService {
  private readonly operation = 'estimate.create';

  constructor(
    private readonly estimating: EstimatingService,
    private readonly estimates: EstimateRepository,
    private readonly receipts: IdempotencyRepository,
  ) {}

  async create(principal: Principal, rawKey: string, input: IdempotentEstimateCreateInput): Promise<{ estimate: Estimate; replayed: boolean }> {
    const idempotencyKey = validateIdempotencyKey(rawKey);
    const normalizedRequest = { tenantId: principal.tenantId, ...input };
    const requestHash = hashIdempotencyRequest(normalizedRequest);
    const resourceId = deterministicIdempotentResourceId(principal.tenantId, this.operation, `${idempotencyKey}:${requestHash}`);
    const claim = await this.receipts.claim({
      tenantId: principal.tenantId,
      operation: this.operation,
      idempotencyKey,
      requestHash,
      resourceId,
    });

    if (claim.receipt.requestHash !== requestHash) throw new Error('idempotency_key_reused_with_different_request');
    const existing = await this.estimates.getById(principal.tenantId, claim.receipt.resourceId);
    if (existing) {
      await this.receipts.complete(principal.tenantId, this.operation, idempotencyKey);
      return { estimate: existing, replayed: true };
    }
    if (!claim.created) throw new Error('idempotency_request_in_progress');

    let estimate: Estimate;
    try {
      estimate = await this.estimating.create(principal, {
        id: claim.receipt.resourceId,
        tenantId: principal.tenantId,
        ...input,
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'estimate_already_exists') throw error;
      const resolved = await this.estimates.getById(principal.tenantId, claim.receipt.resourceId);
      if (!resolved) throw new Error('idempotency_resource_resolution_failed');
      estimate = resolved;
    }
    await this.receipts.complete(principal.tenantId, this.operation, idempotencyKey);
    return { estimate, replayed: false };
  }
}
