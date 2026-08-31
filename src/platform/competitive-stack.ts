import type { AssetClass } from '../domain/types.js';
import { resolveEntitlements, type AutomationLevel, type FeatureId } from './features.js';

export const TOP_TIER_ESTIMATING_FEATURES = [
  'estimate_audit',
  'repair_intelligence',
  'damage_ai',
  'parts_exchange',
  'supplement_prediction',
  'universal_interchange',
  'universal_dispatch',
  'oem_procedures',
  'adas_diagnostics',
  'api_access',
] as const satisfies readonly FeatureId[];

export type CompetitiveStackInput = {
  assetClass: AssetClass;
  enabledFeatures: FeatureId[];
  automationLevel: AutomationLevel;
};

export type CompetitiveStackCertification = {
  green: boolean;
  assetClass: AssetClass;
  resolvedFeatures: FeatureId[];
  missingFeatures: FeatureId[];
  blockers: string[];
  externalProofStillRequired: string[];
};

export function certifyCompetitiveStack(input: CompetitiveStackInput): CompetitiveStackCertification {
  const blockers: string[] = [];
  let resolvedFeatures: FeatureId[] = [];
  try {
    const resolved = resolveEntitlements({ enabled: input.enabledFeatures, automationLevel: input.automationLevel }, input.assetClass);
    resolvedFeatures = [...resolved.enabled].sort();
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }
  const resolved = new Set(resolvedFeatures);
  const required = new Set<FeatureId>(TOP_TIER_ESTIMATING_FEATURES);
  if (input.assetClass !== 'passenger_vehicle' && input.assetClass !== 'commercial_vehicle' && input.assetClass !== 'ambulance_emergency') {
    required.delete('adas_diagnostics');
  }
  const missingFeatures = [...required].filter(feature => !resolved.has(feature)).sort();
  if (missingFeatures.length) blockers.push(`competitive_features_missing:${missingFeatures.join(',')}`);
  if (input.automationLevel === 'manual') blockers.push('competitive_stack_requires_assisted_or_higher');

  return {
    green: blockers.length === 0,
    assetClass: input.assetClass,
    resolvedFeatures,
    missingFeatures,
    blockers,
    externalProofStillRequired: [
      'licensed_provider_activation_where_used',
      'expert_reviewed_benchmark_certification',
      'production_visual_model_certification_where_enabled',
      'production_interchange_partner_certification_where_enabled',
      'production_market_pilot',
    ],
  };
}
