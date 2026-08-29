import type { AssetIdentity } from '../domain/types.js';
import type { ProviderCapability, ProviderDescriptor } from '../connectors/contracts.js';
import { domainForAsset, type EstimatingDomainId } from '../domains/registry.js';
import { resolveEntitlements, type EntitlementPolicy, type FeatureId } from './features.js';

const FEATURE_CAPABILITIES: Partial<Record<FeatureId, ProviderCapability[]>> = {
  vin_build: ['asset_identity','build_configuration'],
  oem_procedures: ['oem_procedures'],
  motor_raced: ['labor_times'],
  parts_optimizer: ['parts','market_pricing'],
  labor_intelligence: ['labor_times','labor_rates'],
  adas_diagnostics: ['adas_requirements','diagnostics'],
  total_loss: ['valuation'],
  market_comps: ['market_pricing'],
  salvage: ['market_pricing'],
  property: ['property_pricing','materials','labor_rates','codes_regulations'],
  collision: [],
  commercial_truck: [],
  heavy_equipment: [],
  powersports: [],
  rv: [],
  marine: [],
  contents: ['valuation','market_pricing'],
  specialty: [],
};

export type PlatformPlan = {
  domain: EstimatingDomainId;
  automationLevel: EntitlementPolicy['automationLevel'];
  enabledFeatures: FeatureId[];
  requiredProviderCapabilities: ProviderCapability[];
  providerCoverage: Record<ProviderCapability, string[]>;
  uncoveredCapabilities: ProviderCapability[];
};

export function buildPlatformPlan(
  asset: AssetIdentity,
  policy: EntitlementPolicy,
  providers: ProviderDescriptor[] = [],
  preferredDomain?: EstimatingDomainId,
): PlatformPlan {
  const domain = domainForAsset(asset, preferredDomain);
  const domainPlan = domain.plan(asset);
  const entitlements = resolveEntitlements(policy, asset.assetClass);
  const required = new Set<ProviderCapability>();
  for (const feature of entitlements.enabled) {
    for (const capability of FEATURE_CAPABILITIES[feature] ?? []) {
      if (domainPlan.providerCapabilities.includes(capability)) required.add(capability);
    }
  }
  const providerCoverage = {} as Record<ProviderCapability, string[]>;
  for (const capability of required) {
    providerCoverage[capability] = providers
      .filter(provider => provider.capabilities.includes(capability))
      .map(provider => provider.id);
  }
  const requiredProviderCapabilities = [...required].sort();
  const uncoveredCapabilities = requiredProviderCapabilities.filter(capability => providerCoverage[capability]?.length === 0);
  return {
    domain: domain.id,
    automationLevel: entitlements.automationLevel,
    enabledFeatures: [...entitlements.enabled].sort(),
    requiredProviderCapabilities,
    providerCoverage,
    uncoveredCapabilities,
  };
}
