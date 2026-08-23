import { randomUUID } from 'node:crypto';
import type { AssetIdentity, Estimate, EstimateLine, Money } from '../domain/types.js';
import { auditEstimateLines, lineTotal } from '../engine/estimate.js';
import { assertValid, validateAssetIdentity, validateCurrency, validateEstimateLineInput, validateJurisdiction } from '../domain/validation.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { CarrierRule } from '../rules/carrier.js';
import { assertNoBlockingFindings, evaluateCarrierRules } from '../rules/carrier.js';
import type { AuditSink } from '../audit/audit.js';
import { auditEvent, NoopAuditSink } from '../audit/audit.js';

export type CreateEstimateInput = {
  tenantId: string;
  claimId?: string;
  asset: AssetIdentity;
  locale: string;
  currency: string;
  jurisdiction: string;
};

function money(amountMinor: number, currency: string): Money {
  return { amountMinor, currency };
}

function recalculate(estimate: Estimate): Estimate {
  const lines = estimate.lines.map((line) => ({ ...line, total: lineTotal(line) }));
  const subtotalMinor = lines.reduce((sum, line) => sum + line.total.amountMinor - (line.tax?.amountMinor ?? 0), 0);
  const taxMinor = lines.reduce((sum, line) => sum + (line.tax?.amountMinor ?? 0), 0);
  return {
    ...estimate,
    lines,
    subtotal: money(subtotalMinor, estimate.currency),
    tax: money(taxMinor, estimate.currency),
    total: money(subtotalMinor + taxMinor, estimate.currency),
    updatedAt: new Date().toISOString(),
  };
}

export class EstimatingService {
  constructor(
    private readonly repository: EstimateRepository,
    private readonly carrierRules: CarrierRule[] = [],
    private readonly audit: AuditSink = new NoopAuditSink(),
  ) {}

  private async record(principal: Principal, action: string, estimate: Estimate, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.audit.record(auditEvent({
      tenantId: estimate.tenantId,
      actorId: principal.userId,
      action,
      resourceType: 'estimate',
      resourceId: estimate.id,
      metadata: { revision: estimate.revision, status: estimate.status, ...metadata },
    }));
  }

  async create(principal: Principal, input: CreateEstimateInput): Promise<Estimate> {
    authorize(principal, 'estimate:create', input.tenantId);
    const currency = input.currency.toUpperCase();
    assertValid([
      ...validateAssetIdentity(input.asset),
      ...validateCurrency(currency),
      ...validateJurisdiction(input.jurisdiction),
    ]);
    if (input.claimId && input.claimId.length > 120) throw new Error('validation_failed:claim_id_too_long');
    const now = new Date().toISOString();
    const estimate: Estimate = {
      id: randomUUID(),
      tenantId: input.tenantId,
      ...(input.claimId ? { claimId: input.claimId } : {}),
      asset: input.asset,
      locale: input.locale,
      currency,
      jurisdiction: input.jurisdiction.trim(),
      lines: [],
      subtotal: money(0, currency),
      tax: money(0, currency),
      total: money(0, currency),
      status: 'draft',
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.repository.create(estimate);
    await this.record(principal, 'estimate.created', saved, saved.claimId ? { claimId: saved.claimId } : {});
    return saved;
  }

  async get(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const estimate = await this.repository.getById(principal.tenantId, id);
    if (!estimate) throw new Error('estimate_not_found');
    return estimate;
  }

  async replaceLines(principal: Principal, id: string, lines: EstimateLine[]): Promise<Estimate> {
    authorize(principal, 'estimate:update', principal.tenantId);
    const current = await this.get(principal, id);
    if (current.status === 'approved' || current.status === 'void') throw new Error('estimate_locked');
    assertValid(lines.flatMap((line) => validateEstimateLineInput(line, current.currency)));
    const saved = await this.repository.save(recalculate({ ...current, lines, status: 'review' }));
    await this.record(principal, 'estimate.lines_replaced', saved, { lineCount: lines.length });
    return saved;
  }

  async approve(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:approve', principal.tenantId);
    const current = await this.get(principal, id);
    const errors = auditEstimateLines(current.lines);
    if (errors.length > 0) throw new Error(`estimate_audit_failed:${errors.join('|')}`);
    if (current.lines.some((line) => !line.humanApproved)) throw new Error('human_approval_required');
    const findings = evaluateCarrierRules(current, this.carrierRules);
    assertNoBlockingFindings(findings);
    const saved = await this.repository.save({ ...recalculate(current), status: 'approved' });
    await this.record(principal, 'estimate.approved', saved, { carrierFindingCount: findings.length });
    return saved;
  }

  async void(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:void', principal.tenantId);
    const current = await this.get(principal, id);
    const saved = await this.repository.save({ ...current, status: 'void', updatedAt: new Date().toISOString() });
    await this.record(principal, 'estimate.voided', saved);
    return saved;
  }
}
