import type { AssetClass } from '../domain/types.js';
import type { ProviderCapability } from '../connectors/contracts.js';
import type { MeshCriticality } from '../agents/mesh.js';
import { buildAgentExecutionPlan } from '../agents/mesh.js';
import {
  resolveEntitlements,
  type AutomationLevel,
  type EntitlementPolicy,
  type FeatureId
} from './features.js';

export type FeatureLane =
  | 'domain'
  | 'identity'
  | 'damage'
  | 'procedures_safety'
  | 'labor_pricing'
  | 'parts'
  | 'decision'
  | 'audit_compliance'
  | 'revision'
  | 'assist'
  | 'collaboration_output';

export type MutationClass = 'read_only' | 'recommendation' | 'draft_mutation' | 'approval_sensitive';

export type FeatureHarmonyDefinition = {
  lane: FeatureLane;
  priority: number;
  criticality: MeshCriticality;
  mutationClass: MutationClass;
  meshCapability?: string;
  providerCapabilities: ProviderCapability[];
};

export type FeatureLanePlan = {
  lane: FeatureLane;
  canonicalOwner: FeatureId;
  participants: FeatureId[];
  suppressedDuplicateExecutions: FeatureId[];
  criticality: MeshCriticality;
  meshPrimary: string | null;
  meshShadows: string[];
};

export type FeatureHarmonyPlan = {
  enabled: FeatureId[];
  automationLevel: AutomationLevel;
  lanes: FeatureLanePlan[];
  blockers: string[];
  warnings: string[];
  requiredProviderCapabilities: ProviderCapability[];
  humanApprovalRequired: true;
  automaticFinalApprovalAllowed: false;
};

const DOMAIN_FEATURES = new Set<FeatureId>([
  'collision','property','commercial_truck','heavy_equipment','powersports','rv','marine','contents','specialty'
]);

const DEFAULT_DEFINITION: FeatureHarmonyDefinition = {
  lane: 'collaboration_output',
  priority: 50,
  criticality: 'routine',
  mutationClass: 'read_only',
  providerCapabilities: []
};

const DEFINITIONS: Partial<Record<FeatureId, FeatureHarmonyDefinition>> = {
  collision: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  property: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: ['property_pricing'] },
  commercial_truck: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  heavy_equipment: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  powersports: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  rv: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  marine: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  contents: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  specialty: { lane: 'domain', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', providerCapabilities: [] },
  super_appraiser: { lane: 'decision', priority: 70, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'audit', providerCapabilities: [] },
  damage_ai: { lane: 'damage', priority: 90, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'damage', providerCapabilities: [] },
  vin_build: { lane: 'identity', priority: 100, criticality: 'important', mutationClass: 'read_only', meshCapability: 'identity', providerCapabilities: ['asset_identity','build_configuration'] },
  oem_procedures: { lane: 'procedures_safety', priority: 100, criticality: 'safety_critical', mutationClass: 'approval_sensitive', meshCapability: 'procedures', providerCapabilities: ['oem_procedures'] },
  motor_raced: { lane: 'labor_pricing', priority: 100, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'pricing', providerCapabilities: ['labor_times'] },
  deg_intelligence: { lane: 'labor_pricing', priority: 80, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'audit', providerCapabilities: [] },
  icar_blueprint: { lane: 'procedures_safety', priority: 90, criticality: 'safety_critical', mutationClass: 'approval_sensitive', meshCapability: 'procedures', providerCapabilities: [] },
  parts_optimizer: { lane: 'parts', priority: 100, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'parts', providerCapabilities: ['parts'] },
  labor_intelligence: { lane: 'labor_pricing', priority: 90, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'pricing', providerCapabilities: ['labor_times','labor_rates'] },
  adas_diagnostics: { lane: 'procedures_safety', priority: 110, criticality: 'safety_critical', mutationClass: 'approval_sensitive', meshCapability: 'procedures', providerCapabilities: ['adas_requirements','diagnostics'] },
  repair_replace: { lane: 'decision', priority: 100, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'damage', providerCapabilities: [] },
  total_loss: { lane: 'decision', priority: 100, criticality: 'important', mutationClass: 'approval_sensitive', meshCapability: 'pricing', providerCapabilities: ['valuation'] },
  market_comps: { lane: 'decision', priority: 80, criticality: 'important', mutationClass: 'read_only', meshCapability: 'pricing', providerCapabilities: ['market_pricing'] },
  salvage: { lane: 'decision', priority: 70, criticality: 'important', mutationClass: 'read_only', meshCapability: 'pricing', providerCapabilities: ['valuation','market_pricing'] },
  fraud_anomaly: { lane: 'audit_compliance', priority: 70, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'fraud', providerCapabilities: [] },
  estimate_audit: { lane: 'audit_compliance', priority: 100, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'audit', providerCapabilities: [] },
  supplements: { lane: 'revision', priority: 100, criticality: 'important', mutationClass: 'draft_mutation', meshCapability: 'supplement', providerCapabilities: [] },
  carrier_compliance: { lane: 'audit_compliance', priority: 90, criticality: 'important', mutationClass: 'approval_sensitive', meshCapability: 'carrier', providerCapabilities: [] },
  screen_copilot: { lane: 'assist', priority: 100, criticality: 'important', mutationClass: 'recommendation', meshCapability: 'audit', providerCapabilities: [] },
  collaboration: { lane: 'collaboration_output', priority: 80, criticality: 'routine', mutationClass: 'draft_mutation', providerCapabilities: [] },
  analytics: { lane: 'collaboration_output', priority: 60, criticality: 'routine', mutationClass: 'read_only', providerCapabilities: [] },
  api_access: { lane: 'collaboration_output', priority: 70, criticality: 'important', mutationClass: 'draft_mutation', meshCapability: 'interoperability', providerCapabilities: [] }
};

function definitionFor(feature: FeatureId): FeatureHarmonyDefinition {
  return DEFINITIONS[feature] ?? DEFAULT_DEFINITION;
}

function mostCritical(values: MeshCriticality[]): MeshCriticality {
  if (values.includes('safety_critical')) return 'safety_critical';
  if (values.includes('important')) return 'important';
  return 'routine';
}

export function buildFeatureHarmonyPlan(
  policy: EntitlementPolicy,
  assetClass: AssetClass,
  availableProviderCapabilities: ReadonlySet<ProviderCapability>
): FeatureHarmonyPlan {
  const entitlements = resolveEntitlements(policy, assetClass);
  const enabled = [...entitlements.enabled].sort();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const requiredCapabilities = new Set<ProviderCapability>();

  const domainFeatures = enabled.filter((feature) => DOMAIN_FEATURES.has(feature));
  if (domainFeatures.length > 1) warnings.push(`multiple_domain_packs_enabled:${domainFeatures.join(',')}`);

  const grouped = new Map<FeatureLane, FeatureId[]>();
  for (const feature of enabled) {
    const definition = definitionFor(feature);
    const lane = grouped.get(definition.lane) ?? [];
    lane.push(feature);
    grouped.set(definition.lane, lane);
    for (const capability of definition.providerCapabilities) {
      requiredCapabilities.add(capability);
      if (!availableProviderCapabilities.has(capability)) blockers.push(`provider_capability_missing:${feature}:${capability}`);
    }
  }

  const lanes: FeatureLanePlan[] = [];
  for (const [lane, participants] of grouped.entries()) {
    const ranked = participants.slice().sort((a, b) => {
      const priorityDelta = definitionFor(b).priority - definitionFor(a).priority;
      return priorityDelta || a.localeCompare(b);
    });
    const canonicalOwner = ranked[0];
    if (!canonicalOwner) continue;
    const criticality = mostCritical(participants.map((feature) => definitionFor(feature).criticality));
    const meshCapabilities = participants.map((feature) => definitionFor(feature).meshCapability).filter((value): value is string => Boolean(value));
    const meshCapability = meshCapabilities[0];
    const mesh = meshCapability ? buildAgentExecutionPlan(meshCapability, criticality) : null;
    lanes.push({
      lane,
      canonicalOwner,
      participants: ranked,
      suppressedDuplicateExecutions: ranked.slice(1),
      criticality,
      meshPrimary: mesh?.primary ?? null,
      meshShadows: mesh?.shadows ?? []
    });
  }

  if (enabled.some((feature) => definitionFor(feature).mutationClass === 'approval_sensitive')) {
    warnings.push('approval_sensitive_features_require_human_review');
  }
  if (policy.automationLevel === 'governed_autonomy') {
    warnings.push('governed_autonomy_is_draft_only_for_final_estimate_actions');
  }

  return {
    enabled,
    automationLevel: entitlements.automationLevel,
    lanes: lanes.sort((a, b) => a.lane.localeCompare(b.lane)),
    blockers: [...new Set(blockers)].sort(),
    warnings: [...new Set(warnings)].sort(),
    requiredProviderCapabilities: [...requiredCapabilities].sort(),
    humanApprovalRequired: true,
    automaticFinalApprovalAllowed: false
  };
}

export function assertFeatureHarmonyReady(plan: FeatureHarmonyPlan): void {
  if (plan.blockers.length) throw new Error(`feature_harmony_blocked:${plan.blockers.join('|')}`);
}
