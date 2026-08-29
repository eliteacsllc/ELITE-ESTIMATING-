import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { TenantEntitlementService } from '../platform/entitlement-service.js';
import { FEATURE_REGISTRY, resolveEntitlements, type FeatureId } from '../platform/features.js';
import { buildFabricExecutionPlan, type FabricAgentSlot, type PerformanceMode, type SuperAgentId } from './fabric.js';
import type { MeshCriticality } from './mesh.js';

export type AgentMeshPlanRequest = {
  feature: FeatureId;
  criticality: MeshCriticality;
  utilization: number;
};

export type AgentMeshPlanView = {
  tenantId: string;
  estimateId: string;
  estimateRevision: number;
  assetClass: string;
  feature: FeatureId;
  superAgent: { id: SuperAgentId; purpose: string };
  criticality: MeshCriticality;
  performanceMode: PerformanceMode;
  primary: FabricAgentSlot;
  shadows: FabricAgentSlot[];
  isolated: FabricAgentSlot[];
  minimumIndependentImplementations: number;
  minimumSourceFamilies: number;
  hedgeAfterMs: number;
  hardDeadlineMs: number;
  controls: string[];
  ticketExpiresAt: string;
  humanApprovalRequired: true;
  automaticFinalMutationAllowed: false;
};

const CRITICALITY = new Set<MeshCriticality>(['routine','important','safety_critical']);

function assertRequest(input: AgentMeshPlanRequest): void {
  if (!input || typeof input !== 'object') throw new Error('agent_mesh_plan_request_required');
  if (typeof input.feature !== 'string' || !(input.feature in FEATURE_REGISTRY)) throw new Error('invalid_agent_mesh_feature');
  if (typeof input.criticality !== 'string' || !CRITICALITY.has(input.criticality)) throw new Error('invalid_agent_mesh_criticality');
  if (!Number.isFinite(input.utilization) || input.utilization < 0 || input.utilization > 1) throw new Error('invalid_agent_mesh_utilization');
}

export class AgentMeshPlanningService {
  constructor(
    private readonly estimates: EstimateRepository,
    private readonly entitlements: TenantEntitlementService,
  ) {}

  async plan(principal: Principal, estimateId: string, input: AgentMeshPlanRequest): Promise<AgentMeshPlanView> {
    authorize(principal, 'estimate:read', principal.tenantId);
    assertRequest(input);
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
    const profile = await this.entitlements.get(principal, estimate.asset.assetClass);
    const resolved = resolveEntitlements({ enabled: profile.enabledFeatures, automationLevel: profile.automationLevel }, estimate.asset.assetClass);
    if (!resolved.enabled.has(input.feature)) throw new Error(`not_permitted:feature_not_entitled:${input.feature}`);
    const plan = buildFabricExecutionPlan({
      tenantId: principal.tenantId,
      estimateId: estimate.id,
      revision: estimate.revision,
      feature: input.feature,
      criticality: input.criticality,
      utilization: input.utilization,
    });
    return {
      tenantId: principal.tenantId,
      estimateId: estimate.id,
      estimateRevision: estimate.revision,
      assetClass: estimate.asset.assetClass,
      feature: plan.feature,
      superAgent: { id: plan.superAgent.id, purpose: plan.superAgent.purpose },
      criticality: plan.criticality,
      performanceMode: plan.performanceMode,
      primary: plan.primary,
      shadows: plan.shadows,
      isolated: plan.isolated,
      minimumIndependentImplementations: plan.minimumIndependentImplementations,
      minimumSourceFamilies: plan.minimumSourceFamilies,
      hedgeAfterMs: plan.hedgeAfterMs,
      hardDeadlineMs: plan.hardDeadlineMs,
      controls: [...plan.controls],
      ticketExpiresAt: plan.ticket.expiresAt,
      humanApprovalRequired: true,
      automaticFinalMutationAllowed: false,
    };
  }
}