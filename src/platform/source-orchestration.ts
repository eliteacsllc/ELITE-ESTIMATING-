import type { AssetIdentity } from '../domain/types.js';
import type { ProviderCapability, ProviderDescriptor } from '../connectors/contracts.js';
import { FREE_FIRST_PROVIDER_DESCRIPTORS } from '../connectors/open-data.js';
import { NWS_ALERTS_DESCRIPTOR } from '../connectors/nws-weather.js';
import { buildPlatformPlan, type PlatformPlan } from './runtime.js';
import { planFreeFirstCoverage, type FreeFirstCoverageItem } from './free-first.js';
import type { EntitlementPolicy } from './features.js';

export type SourceInputGap = {
  capability: ProviderCapability;
  fields: string[];
  reason: string;
};

export type FreeFirstSourcePlan = {
  platform: PlatformPlan;
  automaticCapabilities: ProviderCapability[];
  sourcingCapabilities: ProviderCapability[];
  coverage: FreeFirstCoverageItem[];
  inputGaps: SourceInputGap[];
  authoritativeEvidenceCapabilities: ProviderCapability[];
  customerEvidenceCapabilities: ProviderCapability[];
  paidProviderArchitecturallyRequired: false;
};

const roadVehicleClasses = new Set([
  'passenger_vehicle','commercial_vehicle','tractor_trailer','motorcycle','rv','ambulance_emergency',
]);
const propertyClasses = new Set(['residential_property','commercial_property']);

function dedupeProviders(providers: ProviderDescriptor[]): ProviderDescriptor[] {
  const byId = new Map<string, ProviderDescriptor>();
  for (const provider of providers) byId.set(provider.id, provider);
  return [...byId.values()];
}

function automaticCapabilities(asset: AssetIdentity): ProviderCapability[] {
  const capabilities = new Set<ProviderCapability>();
  if (roadVehicleClasses.has(asset.assetClass)) capabilities.add('safety_recalls');
  if (propertyClasses.has(asset.assetClass)) capabilities.add('weather_catastrophe');
  return [...capabilities].sort();
}

function inputGaps(asset: AssetIdentity, capabilities: ProviderCapability[]): SourceInputGap[] {
  const gaps: SourceInputGap[] = [];
  if (capabilities.includes('asset_identity') || capabilities.includes('build_configuration')) {
    if (roadVehicleClasses.has(asset.assetClass) && (!asset.vin || asset.vin.trim().length !== 17)) {
      gaps.push({ capability: 'asset_identity', fields: ['vin'], reason: 'A 17-character VIN is required for public vPIC vehicle decoding.' });
    }
  }
  if (capabilities.includes('safety_recalls')) {
    const fields = [!asset.year ? 'year' : '', !asset.make?.trim() ? 'make' : '', !asset.model?.trim() ? 'model' : ''].filter(Boolean);
    if (fields.length) gaps.push({ capability: 'safety_recalls', fields, reason: 'Year, make, and model are required for public NHTSA vehicle recall queries.' });
  }
  if (capabilities.includes('weather_catastrophe') && !asset.jurisdiction?.trim()) {
    gaps.push({ capability: 'weather_catastrophe', fields: ['jurisdiction'], reason: 'A US state jurisdiction is required for automatic NWS/OpenFEMA state-scoped catastrophe context.' });
  }
  return gaps;
}

export function buildFreeFirstSourcePlan(
  asset: AssetIdentity,
  policy: EntitlementPolicy,
  providers: ProviderDescriptor[] = [],
): FreeFirstSourcePlan {
  const allProviders = dedupeProviders([...FREE_FIRST_PROVIDER_DESCRIPTORS, NWS_ALERTS_DESCRIPTOR, ...providers]);
  const platform = buildPlatformPlan(asset, policy, allProviders);
  const automatic = automaticCapabilities(asset);
  const sourcingCapabilities = [...new Set([...platform.requiredProviderCapabilities, ...automatic])].sort();
  const coverage = planFreeFirstCoverage(sourcingCapabilities, allProviders);
  return {
    platform,
    automaticCapabilities: automatic,
    sourcingCapabilities,
    coverage,
    inputGaps: inputGaps(asset, sourcingCapabilities),
    authoritativeEvidenceCapabilities: coverage.filter(item => item.status === 'authoritative_evidence_needed').map(item => item.capability),
    customerEvidenceCapabilities: coverage.filter(item => item.status === 'customer_evidence_needed').map(item => item.capability),
    paidProviderArchitecturallyRequired: false,
  };
}
