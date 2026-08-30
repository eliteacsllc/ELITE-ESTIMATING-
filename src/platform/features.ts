import type { AssetClass } from '../domain/types.js';

export type AutomationLevel = 'manual' | 'assisted' | 'copilot' | 'automated_draft' | 'governed_autonomy';

export type FeatureId =
  | 'collision'
  | 'property'
  | 'commercial_truck'
  | 'heavy_equipment'
  | 'powersports'
  | 'rv'
  | 'marine'
  | 'contents'
  | 'specialty'
  | 'super_appraiser'
  | 'damage_ai'
  | 'vin_build'
  | 'oem_procedures'
  | 'motor_raced'
  | 'deg_intelligence'
  | 'icar_blueprint'
  | 'parts_optimizer'
  | 'parts_exchange'
  | 'labor_intelligence'
  | 'adas_diagnostics'
  | 'repair_replace'
  | 'repair_intelligence'
  | 'total_loss'
  | 'market_comps'
  | 'salvage'
  | 'fraud_anomaly'
  | 'estimate_audit'
  | 'supplements'
  | 'supplement_prediction'
  | 'universal_interchange'
  | 'universal_dispatch'
  | 'carrier_compliance'
  | 'screen_copilot'
  | 'collaboration'
  | 'analytics'
  | 'api_access';

export type FeatureDefinition = {
  id: FeatureId;
  optional: true;
  dependencies: FeatureId[];
  assetClasses?: AssetClass[];
  safetyGate?: 'oem' | 'adas' | 'structural' | 'ev_hv';
};

const allVehicle: AssetClass[] = [
  'passenger_vehicle','commercial_vehicle','tractor_trailer','heavy_equipment','motorcycle','atv_utv','rv','marine','ambulance_emergency','crane_specialty','other',
];

export const FEATURE_REGISTRY: Readonly<Record<FeatureId, FeatureDefinition>> = {
  collision: { id: 'collision', optional: true, dependencies: [], assetClasses: ['passenger_vehicle','commercial_vehicle','ambulance_emergency'] },
  property: { id: 'property', optional: true, dependencies: [], assetClasses: ['residential_property','commercial_property'] },
  commercial_truck: { id: 'commercial_truck', optional: true, dependencies: [], assetClasses: ['commercial_vehicle','tractor_trailer','ambulance_emergency'] },
  heavy_equipment: { id: 'heavy_equipment', optional: true, dependencies: [], assetClasses: ['heavy_equipment','crane_specialty'] },
  powersports: { id: 'powersports', optional: true, dependencies: [], assetClasses: ['motorcycle','atv_utv'] },
  rv: { id: 'rv', optional: true, dependencies: [], assetClasses: ['rv'] },
  marine: { id: 'marine', optional: true, dependencies: [], assetClasses: ['marine'] },
  contents: { id: 'contents', optional: true, dependencies: [], assetClasses: ['contents'] },
  specialty: { id: 'specialty', optional: true, dependencies: [], assetClasses: ['other','crane_specialty','ambulance_emergency'] },
  super_appraiser: { id: 'super_appraiser', optional: true, dependencies: ['estimate_audit','repair_intelligence'] },
  damage_ai: { id: 'damage_ai', optional: true, dependencies: ['repair_intelligence'] },
  vin_build: { id: 'vin_build', optional: true, dependencies: [], assetClasses: allVehicle },
  oem_procedures: { id: 'oem_procedures', optional: true, dependencies: [], assetClasses: allVehicle, safetyGate: 'oem' },
  motor_raced: { id: 'motor_raced', optional: true, dependencies: ['labor_intelligence'], assetClasses: allVehicle },
  deg_intelligence: { id: 'deg_intelligence', optional: true, dependencies: ['estimate_audit'], assetClasses: allVehicle },
  icar_blueprint: { id: 'icar_blueprint', optional: true, dependencies: ['oem_procedures','repair_intelligence'], assetClasses: allVehicle },
  parts_optimizer: { id: 'parts_optimizer', optional: true, dependencies: [] },
  parts_exchange: { id: 'parts_exchange', optional: true, dependencies: ['parts_optimizer'] },
  labor_intelligence: { id: 'labor_intelligence', optional: true, dependencies: [] },
  adas_diagnostics: { id: 'adas_diagnostics', optional: true, dependencies: ['oem_procedures','repair_intelligence'], assetClasses: allVehicle, safetyGate: 'adas' },
  repair_replace: { id: 'repair_replace', optional: true, dependencies: ['estimate_audit','repair_intelligence'] },
  repair_intelligence: { id: 'repair_intelligence', optional: true, dependencies: ['estimate_audit'] },
  total_loss: { id: 'total_loss', optional: true, dependencies: ['market_comps'] },
  market_comps: { id: 'market_comps', optional: true, dependencies: [] },
  salvage: { id: 'salvage', optional: true, dependencies: ['total_loss'] },
  fraud_anomaly: { id: 'fraud_anomaly', optional: true, dependencies: [] },
  estimate_audit: { id: 'estimate_audit', optional: true, dependencies: [] },
  supplements: { id: 'supplements', optional: true, dependencies: [] },
  supplement_prediction: { id: 'supplement_prediction', optional: true, dependencies: ['supplements','estimate_audit','repair_intelligence'] },
  universal_interchange: { id: 'universal_interchange', optional: true, dependencies: [] },
  universal_dispatch: { id: 'universal_dispatch', optional: true, dependencies: ['universal_interchange'] },
  carrier_compliance: { id: 'carrier_compliance', optional: true, dependencies: ['estimate_audit'] },
  screen_copilot: { id: 'screen_copilot', optional: true, dependencies: ['estimate_audit','repair_intelligence'] },
  collaboration: { id: 'collaboration', optional: true, dependencies: [] },
  analytics: { id: 'analytics', optional: true, dependencies: [] },
  api_access: { id: 'api_access', optional: true, dependencies: [] },
};

export type EntitlementPolicy = {
  enabled: FeatureId[];
  automationLevel: AutomationLevel;
};

export type EntitlementResult = { enabled: Set<FeatureId>; automationLevel: AutomationLevel };

export function resolveEntitlements(policy: EntitlementPolicy, assetClass?: AssetClass): EntitlementResult {
  const enabled = new Set<FeatureId>();
  const visiting = new Set<FeatureId>();
  const add = (id: FeatureId): void => {
    if (enabled.has(id)) return;
    if (visiting.has(id)) throw new Error(`feature_dependency_cycle:${id}`);
    const definition = FEATURE_REGISTRY[id];
    if (!definition) throw new Error(`unknown_feature:${id}`);
    if (assetClass && definition.assetClasses && !definition.assetClasses.includes(assetClass)) throw new Error(`feature_not_applicable:${id}:${assetClass}`);
    visiting.add(id);
    for (const dependency of definition.dependencies) add(dependency);
    visiting.delete(id);
    enabled.add(id);
  };
  for (const feature of policy.enabled) add(feature);
  return { enabled, automationLevel: policy.automationLevel };
}

export function assertFeatureEnabled(result: EntitlementResult, feature: FeatureId): void {
  if (!result.enabled.has(feature)) throw new Error(`feature_not_entitled:${feature}`);
}
