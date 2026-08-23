import type { SupplementService } from './supplement-service.js';
import type { SupplementRepository } from '../persistence/supplements.js';
import type { Principal } from '../security/rbac.js';
import type { Supplement } from '../workflows/supplement.js';
import {
  deterministicIdempotentResourceId,
  hashIdempotencyRequest,
  validateIdempotencyKey,
  type IdempotencyRepository,
} from '../api/idempotency.js';

export class IdempotentSupplementCreationService {
  private readonly operation = 'supplement.create';

  constructor(
    private readonly supplementsService: SupplementService,
    private readonly supplements: SupplementRepository,
    private readonly receipts: IdempotencyRepository,
  ) {}

  async create(principal: Principal, rawKey: string, estimateId: string): Promise<{ supplement: Supplement; replayed: boolean }> {
    const idempotencyKey = validateIdempotencyKey(rawKey);
    const normalizedRequest = { tenantId: principal.tenantId, estimateId };
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
    const existing = await this.supplements.getById(principal.tenantId, claim.receipt.resourceId);
    if (existing) {
      if (existing.estimateId !== estimateId) throw new Error('idempotency_resource_conflict');
      await this.receipts.complete(principal.tenantId, this.operation, idempotencyKey);
      return { supplement: existing, replayed: true };
    }
    if (!claim.created) throw new Error('idempotency_request_in_progress');

    let supplement: Supplement;
    try {
      supplement = await this.supplementsService.create(principal, estimateId, claim.receipt.resourceId);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'supplement_already_exists') throw error;
      const resolved = await this.supplements.getById(principal.tenantId, claim.receipt.resourceId);
      if (!resolved) throw new Error('idempotency_resource_resolution_failed');
      if (resolved.estimateId !== estimateId) throw new Error('idempotency_resource_conflict');
      supplement = resolved;
    }
    await this.receipts.complete(principal.tenantId, this.operation, idempotencyKey);
    return { supplement, replayed: false };
  }
}
