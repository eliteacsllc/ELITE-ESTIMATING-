import type { ProviderCapability } from '../connectors/contracts.js';
import type { AssetClass } from '../domain/types.js';
import type { EntitlementPolicy } from '../platform/features.js';
import {
  buildFeatureHarmonyPlan,
  type FeatureHarmonyPlan,
  type FeatureLane,
  type FeatureLanePlan
} from '../platform/harmonization.js';
import type { MeshCriticality } from './mesh.js';

export type ExecutionState = 'ready' | 'blocked';

export type PerformanceBudget = {
  deadlineMs: number;
  hedgeAfterMs: number;
  maxParallelAgents: number;
  maxFailuresBeforeEscalation: number;
};

export type ExecutionLaneEnvelope = {
  lane: FeatureLane;
  order: number;
  canonicalOwner: string;
  participants: string[];
  primaryAgent: string;
  shadowAgents: string[];
  criticality: MeshCriticality;
  idempotencyKey: string;
  performance: PerformanceBudget;
  securityAgents: ['security-governance', 'quality-verification'];
  recoveryAgent: 'recovery-fallback';
  harmonizerAgent: 'harmonization';
  humanApprovalRequired: true;
  finalMutationAllowed: false;
};

export type ControlPlaneContext = {
  tenantId: string;
  estimateId: string;
  estimateRevision: number;
  assetClass: AssetClass;
  entitlements: EntitlementPolicy;
  providerCapabilities: ReadonlySet<ProviderCapability>;
};

export type ControlPlaneEnvelope = {
  state: ExecutionState;
  tenantId: string;
  estimateId: string;
  estimateRevision: number;
  assetClass: AssetClass;
  featureHarmony: FeatureHarmonyPlan;
  lanes: ExecutionLaneEnvelope[];
  blockers: string[];
  warnings: string[];
  humanApprovalRequired: true;
  automaticFinalApprovalAllowed: false;
  staleRevisionFailsClosed: true;
};

const LANE_ORDER: readonly FeatureLane[] = [
  'domain',
  'identity',
  'damage',
  'procedures_safety',
  'labor_pricing',
  'parts',
  'decision',
  'audit_compliance',
  'revision',
  'assist',
  'collaboration_output'
];

function requireId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label}_required`);
  if (normalized.length > 180) throw new Error(`${label}_too_long`);
  return normalized;
}

function budgetFor(criticality: MeshCriticality): PerformanceBudget {
  if (criticality === 'safety_critical') {
    return { deadlineMs: 4500, hedgeAfterMs: 150, maxParallelAgents: 4, maxFailuresBeforeEscalation: 0 };
  }
  if (criticality === 'important') {
    return { deadlineMs: 3000, hedgeAfterMs: 350, maxParallelAgents: 3, maxFailuresBeforeEscalation: 1 };
  }
  return { deadlineMs: 1800, hedgeAfterMs: 600, maxParallelAgents: 2, maxFailuresBeforeEscalation: 1 };
}

function laneOrder(lane: FeatureLane): number {
  const index = LANE_ORDER.indexOf(lane);
  return index === -1 ? LANE_ORDER.length : index;
}

function buildLaneEnvelope(
  context: Pick<ControlPlaneContext, 'tenantId' | 'estimateId' | 'estimateRevision'>,
  lane: FeatureLanePlan
): ExecutionLaneEnvelope {
  const primaryAgent = lane.meshPrimary ?? 'orchestrator';
  const shadowAgents = lane.meshShadows.filter((agent) => agent !== primaryAgent);
  const idempotencyKey = [
    'mesh',
    encodeURIComponent(context.tenantId),
    encodeURIComponent(context.estimateId),
    `r${context.estimateRevision}`,
    lane.lane,
    lane.canonicalOwner
  ].join(':');

  return {
    lane: lane.lane,
    order: laneOrder(lane.lane),
    canonicalOwner: lane.canonicalOwner,
    participants: lane.participants,
    primaryAgent,
    shadowAgents,
    criticality: lane.criticality,
    idempotencyKey,
    performance: budgetFor(lane.criticality),
    securityAgents: ['security-governance', 'quality-verification'],
    recoveryAgent: 'recovery-fallback',
    harmonizerAgent: 'harmonization',
    humanApprovalRequired: true,
    finalMutationAllowed: false
  };
}

export function buildControlPlaneEnvelope(context: ControlPlaneContext): ControlPlaneEnvelope {
  const tenantId = requireId(context.tenantId, 'tenant_id');
  const estimateId = requireId(context.estimateId, 'estimate_id');
  if (!Number.isSafeInteger(context.estimateRevision) || context.estimateRevision < 1) {
    throw new Error('estimate_revision_invalid');
  }

  const featureHarmony = buildFeatureHarmonyPlan(
    context.entitlements,
    context.assetClass,
    context.providerCapabilities
  );
  const lanes = featureHarmony.lanes
    .map((lane) => buildLaneEnvelope({ tenantId, estimateId, estimateRevision: context.estimateRevision }, lane))
    .sort((a, b) => a.order - b.order || a.lane.localeCompare(b.lane));

  return {
    state: featureHarmony.blockers.length ? 'blocked' : 'ready',
    tenantId,
    estimateId,
    estimateRevision: context.estimateRevision,
    assetClass: context.assetClass,
    featureHarmony,
    lanes,
    blockers: featureHarmony.blockers,
    warnings: featureHarmony.warnings,
    humanApprovalRequired: true,
    automaticFinalApprovalAllowed: false,
    staleRevisionFailsClosed: true
  };
}

export function assertControlPlaneDispatchable(envelope: ControlPlaneEnvelope, currentRevision: number): void {
  if (envelope.state !== 'ready') throw new Error(`control_plane_blocked:${envelope.blockers.join('|')}`);
  if (currentRevision !== envelope.estimateRevision) {
    throw new Error(`control_plane_stale_revision:${envelope.estimateRevision}:${currentRevision}`);
  }
}

export function shouldLaunchShadowAgent(
  lane: ExecutionLaneEnvelope,
  elapsedMs: number,
  primaryCompleted: boolean,
  primaryFailed: boolean
): boolean {
  if (!lane.shadowAgents.length) return false;
  if (primaryCompleted && !primaryFailed) return false;
  if (primaryFailed) return true;
  return elapsedMs >= lane.performance.hedgeAfterMs;
}
