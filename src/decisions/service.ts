import { randomUUID } from 'node:crypto';
import type { Estimate } from '../domain/types.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { TenantEntitlementService } from '../platform/entitlement-service.js';
import { resolveEntitlements, assertFeatureEnabled, type FeatureId } from '../platform/features.js';
import { optimizeParts, type PartCandidate, type PartsOptimizationPolicy, type PartsOptimizationResult } from '../engine/parts-optimizer.js';
import { decideRepairOrReplace, type RepairOption, type ReplaceOption, type RepairReplacePolicy, type RepairReplaceDecision } from '../engine/repair-replace.js';
import { analyzeTotalLoss, type TotalLossInput, type TotalLossAnalysis } from '../engine/total-loss.js';
import { hashIdempotencyRequest } from '../api/idempotency.js';
import type { AuditSink } from '../audit/audit.js';
import { auditEvent, NoopAuditSink } from '../audit/audit.js';
import type { DecisionRecord, DecisionRecordRepository, DecisionType } from './repository.js';

export type PartsDecisionInput = { candidates: PartCandidate[]; policy: PartsOptimizationPolicy };
export type RepairReplaceDecisionInput = { repair: RepairOption; replacement: ReplaceOption; policy: RepairReplacePolicy };

export type GovernedDecision<T> = { record: DecisionRecord; result: T };

const FEATURE_BY_DECISION: Record<DecisionType, FeatureId> = {
  parts_optimization: 'parts_optimizer',
  repair_replace: 'repair_replace',
  total_loss: 'total_loss',
};

export class GovernedDecisionService {
  constructor(
    private readonly estimates: EstimateRepository,
    private readonly entitlements: TenantEntitlementService,
    private readonly decisions: DecisionRecordRepository,
    private readonly audit: AuditSink = new NoopAuditSink(),
  ) {}

  private async context(principal: Principal, estimateId: string, decisionType: DecisionType): Promise<Estimate> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
    const profile = await this.entitlements.get(principal, estimate.asset.assetClass);
    const resolved = resolveEntitlements({ enabled: profile.enabledFeatures, automationLevel: profile.automationLevel }, estimate.asset.assetClass);
    assertFeatureEnabled(resolved, FEATURE_BY_DECISION[decisionType]);
    return estimate;
  }

  private async persist<T>(principal: Principal, estimate: Estimate, decisionType: DecisionType, input: unknown, result: T): Promise<GovernedDecision<T>> {
    const record: DecisionRecord = {
      tenantId: principal.tenantId,
      id: randomUUID(),
      estimateId: estimate.id,
      estimateRevision: estimate.revision,
      decisionType,
      inputHash: hashIdempotencyRequest(input),
      result,
      createdBy: principal.userId,
      createdAt: new Date().toISOString(),
    };
    const saved = await this.decisions.create(record);
    await this.audit.record(auditEvent({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `decision.${decisionType}.created`,
      resourceType: 'estimate_decision',
      resourceId: saved.id,
      metadata: { estimateId: estimate.id, estimateRevision: saved.estimateRevision, decisionType, inputHash: saved.inputHash },
    }));
    return { record: saved, result };
  }

  async optimizeParts(principal: Principal, estimateId: string, input: PartsDecisionInput): Promise<GovernedDecision<PartsOptimizationResult>> {
    const estimate = await this.context(principal, estimateId, 'parts_optimization');
    if (input.policy.currency !== estimate.currency) throw new Error('decision_currency_mismatch');
    const result = optimizeParts(input.candidates, input.policy);
    return this.persist(principal, estimate, 'parts_optimization', input, result);
  }

  async repairOrReplace(principal: Principal, estimateId: string, input: RepairReplaceDecisionInput): Promise<GovernedDecision<RepairReplaceDecision>> {
    const estimate = await this.context(principal, estimateId, 'repair_replace');
    if (input.policy.currency !== estimate.currency) throw new Error('decision_currency_mismatch');
    const result = decideRepairOrReplace(input.repair, input.replacement, input.policy);
    return this.persist(principal, estimate, 'repair_replace', input, result);
  }

  async totalLoss(principal: Principal, estimateId: string, input: TotalLossInput): Promise<GovernedDecision<TotalLossAnalysis>> {
    const estimate = await this.context(principal, estimateId, 'total_loss');
    if (input.currency !== estimate.currency) throw new Error('decision_currency_mismatch');
    const result = analyzeTotalLoss(input);
    return this.persist(principal, estimate, 'total_loss', input, result);
  }

  async list(principal: Principal, estimateId: string, limit = 100): Promise<DecisionRecord[]> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
    return this.decisions.listByEstimate(principal.tenantId, estimateId, limit);
  }
}
