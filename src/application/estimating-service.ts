import { randomUUID } from 'node:crypto';
import type { AssetIdentity, Estimate, EstimateLine, Money } from '../domain/types.js';
import { nextUpdatedAt } from '../domain/versioning.js';
import { auditEstimateLines, lineTotal } from '../engine/estimate.js';
import { assertValid, validateAssetIdentity, validateCurrency, validateEstimateLineInput, validateJurisdiction } from '../domain/validation.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { CarrierRule } from '../rules/carrier.js';
import { assertNoBlockingFindings, evaluateCarrierRules } from '../rules/carrier.js';
import { assertNoMotorGuideBlockers } from '../rules/motor-guide.js';
import type { RepairPlanningChecklist } from '../workflows/repair-planning.js';
import { assertRepairPlanReady, assertRepairPlanningChecklist } from '../workflows/repair-planning.js';
import type { DomainWorkflowState, UpdateDomainWorkflowStepInput } from '../workflows/domain-workflow.js';
import { assertDomainWorkflowComplete, createDomainWorkflow, updateDomainWorkflowStep } from '../workflows/domain-workflow.js';
import type { AuditSink } from '../audit/audit.js';
import { auditEvent, NoopAuditSink } from '../audit/audit.js';
import type { LifecycleSink, LifecycleTopic } from '../integrations/outbox.js';
import { lifecycleEvent, NoopLifecycleSink } from '../integrations/outbox.js';

export type CreateEstimateInput = {
  id?: string;
  tenantId: string;
  claimId?: string;
  asset: AssetIdentity;
  locale: string;
  currency: string;
  jurisdiction: string;
};

export type UpdateEstimateDomainWorkflowStepInput = Omit<UpdateDomainWorkflowStepInput, 'completedBy' | 'completedAt'>;

function money(amountMinor: number, currency: string): Money { return { amountMinor, currency }; }

function recalculate(estimate: Estimate): Estimate {
  const lines = estimate.lines.map((line) => ({ ...line, total: lineTotal(line) }));
  const subtotalMinor = lines.reduce((sum, line) => sum + line.total.amountMinor - (line.tax?.amountMinor ?? 0), 0);
  const taxMinor = lines.reduce((sum, line) => sum + (line.tax?.amountMinor ?? 0), 0);
  return { ...estimate, lines, subtotal: money(subtotalMinor, estimate.currency), tax: money(taxMinor, estimate.currency), total: money(subtotalMinor + taxMinor, estimate.currency), updatedAt: nextUpdatedAt(estimate.updatedAt) };
}

export class EstimatingService {
  constructor(
    private readonly repository: EstimateRepository,
    private readonly carrierRules: CarrierRule[] = [],
    private readonly audit: AuditSink = new NoopAuditSink(),
    private readonly lifecycle: LifecycleSink = new NoopLifecycleSink(),
  ) {}

  private async record(principal: Principal, action: string, estimate: Estimate, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.audit.record(auditEvent({ tenantId: estimate.tenantId, actorId: principal.userId, action, resourceType: 'estimate', resourceId: estimate.id, metadata: { revision: estimate.revision, status: estimate.status, ...metadata } }));
  }

  private async emit(topic: LifecycleTopic, estimate: Estimate, payload: Record<string, unknown> = {}): Promise<void> {
    await this.lifecycle.emit(lifecycleEvent({ tenantId: estimate.tenantId, topic, aggregateType: 'estimate', aggregateId: estimate.id, payload: { estimateId: estimate.id, claimId: estimate.claimId ?? null, revision: estimate.revision, status: estimate.status, ...payload }, idempotencyKey: `${topic}:${estimate.tenantId}:${estimate.id}:r${estimate.revision}:${estimate.updatedAt}` }));
  }

  async create(principal: Principal, input: CreateEstimateInput): Promise<Estimate> {
    authorize(principal, 'estimate:create', input.tenantId);
    const currency = input.currency.toUpperCase();
    assertValid([...validateAssetIdentity(input.asset), ...validateCurrency(currency), ...validateJurisdiction(input.jurisdiction)]);
    if (input.claimId && input.claimId.length > 120) throw new Error('validation_failed:claim_id_too_long');
    if (input.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) throw new Error('validation_failed:estimate_id_invalid');
    const now = new Date().toISOString();
    const estimate: Estimate = { id: input.id ?? randomUUID(), tenantId: input.tenantId, ...(input.claimId ? { claimId: input.claimId } : {}), asset: input.asset, locale: input.locale, currency, jurisdiction: input.jurisdiction.trim(), lines: [], subtotal: money(0, currency), tax: money(0, currency), total: money(0, currency), status: 'draft', revision: 1, createdAt: now, updatedAt: now };
    const saved = await this.repository.create(estimate);
    await this.record(principal, 'estimate.created', saved, saved.claimId ? { claimId: saved.claimId } : {});
    await this.emit('estimate.created', saved, { assetClass: saved.asset.assetClass });
    return saved;
  }

  async get(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const estimate = await this.repository.getById(principal.tenantId, id);
    if (!estimate) throw new Error('estimate_not_found');
    return estimate;
  }

  async listRecent(principal: Principal, limit = 25): Promise<Estimate[]> { authorize(principal, 'estimate:read', principal.tenantId); return this.repository.listRecent(principal.tenantId, limit); }

  async listByClaim(principal: Principal, claimId: string): Promise<Estimate[]> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const normalized = claimId.trim();
    if (!normalized) throw new Error('claim_id_required');
    if (normalized.length > 120) throw new Error('validation_failed:claim_id_too_long');
    return this.repository.listByClaim(principal.tenantId, normalized);
  }

  async replaceLines(principal: Principal, id: string, lines: EstimateLine[]): Promise<Estimate> {
    authorize(principal, 'estimate:update', principal.tenantId);
    const current = await this.get(principal, id);
    if (current.status === 'approved' || current.status === 'void') throw new Error('estimate_locked');
    assertValid(lines.flatMap((line) => validateEstimateLineInput(line, current.currency)));
    const saved = await this.repository.save(recalculate({ ...current, lines, status: 'review' }), current.updatedAt);
    await this.record(principal, 'estimate.lines_replaced', saved, { lineCount: lines.length });
    await this.emit('estimate.lines_updated', saved, { lineCount: lines.length, totalMinor: saved.total.amountMinor, currency: saved.currency });
    return saved;
  }

  async replaceRepairPlan(principal: Principal, id: string, repairPlan: RepairPlanningChecklist): Promise<Estimate> {
    authorize(principal, 'estimate:update', principal.tenantId);
    assertRepairPlanningChecklist(repairPlan);
    const current = await this.get(principal, id);
    if (current.status === 'approved' || current.status === 'void') throw new Error('estimate_locked');
    const saved = await this.repository.save({ ...current, repairPlan: structuredClone(repairPlan), status: 'review', updatedAt: nextUpdatedAt(current.updatedAt) }, current.updatedAt);
    await this.record(principal, 'estimate.repair_plan_updated', saved);
    await this.emit('estimate.lines_updated', saved, { repairPlanUpdated: true });
    return saved;
  }

  async initializeDomainWorkflow(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:update', principal.tenantId);
    const current = await this.get(principal, id);
    if (current.status === 'approved' || current.status === 'void') throw new Error('estimate_locked');
    if (current.domainWorkflow) return current;
    const domainWorkflow = createDomainWorkflow(current.asset);
    const saved = await this.repository.save({ ...current, domainWorkflow, status: 'review', updatedAt: nextUpdatedAt(current.updatedAt) }, current.updatedAt);
    await this.record(principal, 'estimate.domain_workflow_initialized', saved, { domain: domainWorkflow.domain });
    await this.emit('estimate.lines_updated', saved, { domainWorkflowInitialized: true, domain: domainWorkflow.domain });
    return saved;
  }

  async updateDomainWorkflowStep(principal: Principal, id: string, input: UpdateEstimateDomainWorkflowStepInput): Promise<Estimate> {
    authorize(principal, 'estimate:update', principal.tenantId);
    const current = await this.get(principal, id);
    if (current.status === 'approved' || current.status === 'void') throw new Error('estimate_locked');
    if (!current.domainWorkflow) throw new Error('domain_workflow_not_initialized');
    if (!input || typeof input !== 'object' || typeof input.stepId !== 'string' || !input.stepId.trim()) throw new Error('invalid_domain_workflow_step');
    if (!['pending','complete','not_applicable'].includes(input.status)) throw new Error('invalid_domain_workflow_status');
    if (input.evidenceRefs !== undefined && (!Array.isArray(input.evidenceRefs) || !input.evidenceRefs.every(value => typeof value === 'string'))) throw new Error('invalid_domain_workflow_evidence_refs');
    if (input.note !== undefined && typeof input.note !== 'string') throw new Error('invalid_domain_workflow_note');
    const domainWorkflow = updateDomainWorkflowStep(current.domainWorkflow, {
      stepId: input.stepId.trim(),
      status: input.status,
      ...(input.evidenceRefs ? { evidenceRefs: input.evidenceRefs } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...((input.status === 'complete' || input.status === 'not_applicable') ? { completedBy: principal.userId } : {}),
    });
    const saved = await this.repository.save({ ...current, domainWorkflow, status: 'review', updatedAt: nextUpdatedAt(current.updatedAt) }, current.updatedAt);
    await this.record(principal, 'estimate.domain_workflow_step_updated', saved, { domain: domainWorkflow.domain, stepId: input.stepId, stepStatus: input.status });
    await this.emit('estimate.lines_updated', saved, { domainWorkflowUpdated: true, domain: domainWorkflow.domain, stepId: input.stepId });
    return saved;
  }

  async replaceDomainWorkflow(principal: Principal, id: string, domainWorkflow: DomainWorkflowState): Promise<Estimate> {
    authorize(principal, 'estimate:update', principal.tenantId);
    const current = await this.get(principal, id);
    if (current.status === 'approved' || current.status === 'void') throw new Error('estimate_locked');
    const saved = await this.repository.save({ ...current, domainWorkflow: structuredClone(domainWorkflow), status: 'review', updatedAt: nextUpdatedAt(current.updatedAt) }, current.updatedAt);
    await this.record(principal, 'estimate.domain_workflow_updated', saved, { domain: domainWorkflow.domain });
    await this.emit('estimate.lines_updated', saved, { domainWorkflowUpdated: true, domain: domainWorkflow.domain });
    return saved;
  }

  async approve(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:approve', principal.tenantId);
    const current = await this.get(principal, id);
    const errors = auditEstimateLines(current.lines);
    if (errors.length > 0) throw new Error(`estimate_audit_failed:${errors.join('|')}`);
    if (current.lines.some((line) => !line.humanApproved)) throw new Error('human_approval_required');
    const motorFindings = assertNoMotorGuideBlockers(current.lines);
    const requiresRepairPlan = current.lines.some((line) => line.guide !== undefined || line.safetyCritical === true);
    let repairPlanFindingCount = 0;
    if (requiresRepairPlan) {
      if (!current.repairPlan) throw new Error('repair_plan_required');
      repairPlanFindingCount = assertRepairPlanReady(current, current.repairPlan).length;
    }
    let domainWorkflowWarningCount = 0;
    if (current.domainWorkflow) domainWorkflowWarningCount = assertDomainWorkflowComplete(current.domainWorkflow).warnings.length;
    const findings = evaluateCarrierRules(current, this.carrierRules);
    assertNoBlockingFindings(findings);
    const saved = await this.repository.save({ ...recalculate(current), status: 'approved' }, current.updatedAt);
    await this.record(principal, 'estimate.approved', saved, { carrierFindingCount: findings.length, motorGuideFindingCount: motorFindings.length, repairPlanFindingCount, domainWorkflowWarningCount });
    await this.emit('estimate.approved', saved, { totalMinor: saved.total.amountMinor, currency: saved.currency });
    return saved;
  }

  async void(principal: Principal, id: string): Promise<Estimate> {
    authorize(principal, 'estimate:void', principal.tenantId);
    const current = await this.get(principal, id);
    const saved = await this.repository.save({ ...current, status: 'void', updatedAt: nextUpdatedAt(current.updatedAt) }, current.updatedAt);
    await this.record(principal, 'estimate.voided', saved);
    await this.emit('estimate.voided', saved);
    return saved;
  }
}
