import type { Estimate, EstimateLine, Money } from '../domain/types.js';
import { nextUpdatedAt } from '../domain/versioning.js';
import { lineTotal } from '../engine/estimate.js';
import { assertValid, validateEstimateLineInput } from '../domain/validation.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { SupplementRepository } from '../persistence/supplements.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import { applyApprovedSupplement, createSupplement, type Supplement, type SupplementChange } from '../workflows/supplement.js';
import type { LifecycleSink, LifecycleTopic } from '../integrations/outbox.js';
import { lifecycleEvent, NoopLifecycleSink } from '../integrations/outbox.js';

export type AddSupplementChangeInput = {
  type: SupplementChange['type'];
  lineId?: string;
  line?: EstimateLine;
  reason: string;
};

function money(amountMinor: number, currency: string): Money { return { amountMinor, currency }; }

function recalculate(estimate: Estimate): Estimate {
  const lines = estimate.lines.map((line) => ({ ...line, total: lineTotal(line) }));
  const subtotalMinor = lines.reduce((sum, line) => sum + line.total.amountMinor - (line.tax?.amountMinor ?? 0), 0);
  const taxMinor = lines.reduce((sum, line) => sum + (line.tax?.amountMinor ?? 0), 0);
  return { ...estimate, lines, subtotal: money(subtotalMinor, estimate.currency), tax: money(taxMinor, estimate.currency), total: money(subtotalMinor + taxMinor, estimate.currency), updatedAt: nextUpdatedAt(estimate.updatedAt) };
}

export class SupplementService {
  constructor(
    private readonly estimates: EstimateRepository,
    private readonly supplements: SupplementRepository,
    private readonly lifecycle: LifecycleSink = new NoopLifecycleSink(),
  ) {}

  private async getEstimate(principal: Principal, estimateId: string): Promise<Estimate> {
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
    return estimate;
  }

  private async getSupplement(principal: Principal, supplementId: string): Promise<Supplement> {
    const supplement = await this.supplements.getById(principal.tenantId, supplementId);
    if (!supplement) throw new Error('supplement_not_found');
    return supplement;
  }

  private async emit(topic: LifecycleTopic, tenantId: string, supplement: Supplement, payload: Record<string, unknown> = {}): Promise<void> {
    await this.lifecycle.emit(lifecycleEvent({
      tenantId,
      topic,
      aggregateType: 'supplement',
      aggregateId: supplement.id,
      payload: { supplementId: supplement.id, estimateId: supplement.estimateId, baseRevision: supplement.baseRevision, status: supplement.status, changeCount: supplement.changes.length, ...payload },
      idempotencyKey: `${topic}:${tenantId}:${supplement.id}:${supplement.status}:${supplement.changes.length}`,
    }));
  }

  async create(principal: Principal, estimateId: string, id?: string): Promise<Supplement> {
    authorize(principal, 'supplement:create', principal.tenantId);
    const estimate = await this.getEstimate(principal, estimateId);
    const saved = await this.supplements.create(principal.tenantId, createSupplement(estimate, id));
    await this.emit('supplement.created', principal.tenantId, saved);
    return saved;
  }

  async addChange(principal: Principal, supplementId: string, input: AddSupplementChangeInput): Promise<Supplement> {
    authorize(principal, 'supplement:update', principal.tenantId);
    const supplement = await this.getSupplement(principal, supplementId);
    if (supplement.status !== 'draft') throw new Error('supplement_locked');
    if (!input.reason.trim() || input.reason.length > 1000) throw new Error('invalid_supplement_reason');
    const estimate = await this.getEstimate(principal, supplement.estimateId);
    if (input.line) assertValid(validateEstimateLineInput(input.line, estimate.currency));
    if (input.type === 'add' && !input.line) throw new Error('supplement_add_requires_line');
    if (input.type === 'remove' && !input.lineId) throw new Error('supplement_remove_requires_line_id');
    if (input.type === 'replace' && (!input.lineId || !input.line)) throw new Error('supplement_replace_requires_line');
    const change: SupplementChange = {
      type: input.type,
      ...(input.lineId ? { lineId: input.lineId } : {}),
      ...(input.line ? { line: input.line } : {}),
      reason: input.reason.trim(), requestedBy: principal.userId, requestedAt: new Date().toISOString(),
    };
    const saved = await this.supplements.save(principal.tenantId, { ...supplement, changes: [...supplement.changes, change] });
    await this.emit('supplement.updated', principal.tenantId, saved, { changeType: change.type });
    return saved;
  }

  async submit(principal: Principal, supplementId: string): Promise<Supplement> {
    authorize(principal, 'supplement:submit', principal.tenantId);
    const supplement = await this.getSupplement(principal, supplementId);
    if (supplement.status !== 'draft' || supplement.changes.length === 0) throw new Error('supplement_not_submittable');
    const saved = await this.supplements.save(principal.tenantId, { ...supplement, status: 'submitted' });
    await this.emit('supplement.submitted', principal.tenantId, saved);
    return saved;
  }

  async approve(principal: Principal, supplementId: string): Promise<{ supplement: Supplement; estimate: Estimate }> {
    authorize(principal, 'supplement:approve', principal.tenantId);
    const supplement = await this.getSupplement(principal, supplementId);
    if (supplement.status !== 'submitted') throw new Error('supplement_not_submitted');
    const estimate = await this.getEstimate(principal, supplement.estimateId);
    const approved: Supplement = { ...supplement, status: 'approved' };
    const applied = recalculate(applyApprovedSupplement(estimate, approved));
    assertValid(applied.lines.flatMap((line) => validateEstimateLineInput(line, applied.currency)));

    let result: { supplement: Supplement; estimate: Estimate };
    if (this.supplements.approveAndApply) {
      result = await this.supplements.approveAndApply(principal.tenantId, approved, applied, estimate.updatedAt);
    } else {
      const savedSupplement = await this.supplements.save(principal.tenantId, approved);
      try {
        const savedEstimate = await this.estimates.save(applied, estimate.updatedAt);
        result = { supplement: savedSupplement, estimate: savedEstimate };
      } catch (error) {
        try { await this.supplements.save(principal.tenantId, supplement); } catch { /* best-effort local/test rollback */ }
        throw error;
      }
    }

    await this.emit('supplement.approved', principal.tenantId, result.supplement, { resultingRevision: result.estimate.revision, totalMinor: result.estimate.total.amountMinor, currency: result.estimate.currency });
    return result;
  }

  async list(principal: Principal, estimateId: string): Promise<Supplement[]> {
    authorize(principal, 'estimate:read', principal.tenantId);
    await this.getEstimate(principal, estimateId);
    return this.supplements.listByEstimate(principal.tenantId, estimateId);
  }
}
