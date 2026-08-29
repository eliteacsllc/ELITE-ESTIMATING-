import type { ProviderCapability, ProviderDescriptor } from '../connectors/contracts.js';

export type FreeFirstFallback =
  | 'public_api'
  | 'public_reference'
  | 'customer_evidence'
  | 'documented_manual_entry'
  | 'authoritative_evidence_required';

export type FreeFirstCapabilityRule = {
  capability: ProviderCapability;
  fallbacks: FreeFirstFallback[];
  paidProviderRequired: false;
  safetySensitive: boolean;
  note: string;
};

export const FREE_FIRST_CAPABILITY_POLICY: Readonly<Record<ProviderCapability, FreeFirstCapabilityRule>> = {
  asset_identity: { capability: 'asset_identity', fallbacks: ['public_api','customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Prefer NHTSA vPIC for US road vehicles; allow verified serial/VIN evidence elsewhere.' },
  build_configuration: { capability: 'build_configuration', fallbacks: ['public_api','customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use public decode/build data when available and corroborate configuration from labels, build sheets, photos or owner records.' },
  parts: { capability: 'parts', fallbacks: ['customer_evidence','public_reference','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use authorized supplier quotes, dealer quotes, recycler quotes and customer-owned catalogs; record source and timestamp.' },
  labor_times: { capability: 'labor_times', fallbacks: ['customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Licensed guides are optional; estimator-entered or customer-owned labor references must retain provenance and override rationale.' },
  labor_rates: { capability: 'labor_rates', fallbacks: ['customer_evidence','public_reference','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use contracts, posted shop rates, historical authorized invoices or regional evidence.' },
  materials: { capability: 'materials', fallbacks: ['customer_evidence','public_reference','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use supplier invoices, published product data and documented estimator quantities.' },
  market_pricing: { capability: 'market_pricing', fallbacks: ['public_reference','customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use lawful public listings and customer-provided quotes/comparables; retain URLs or uploaded evidence.' },
  oem_procedures: { capability: 'oem_procedures', fallbacks: ['customer_evidence','public_reference','authoritative_evidence_required'], paidProviderRequired: false, safetySensitive: true, note: 'No paid platform is mandatory, but a safety-critical procedure cannot be inferred. Require an authoritative OEM/public/customer-authorized source.' },
  adas_requirements: { capability: 'adas_requirements', fallbacks: ['customer_evidence','public_reference','authoritative_evidence_required'], paidProviderRequired: false, safetySensitive: true, note: 'Calibration/scan requirements need authoritative evidence; AI may locate or summarize evidence but cannot invent it.' },
  diagnostics: { capability: 'diagnostics', fallbacks: ['customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: true, note: 'Use scan reports, DTC evidence, tool output and OEM/customer-authorized diagnostic instructions.' },
  valuation: { capability: 'valuation', fallbacks: ['public_reference','customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use lawful comparables, dealer quotes, condition evidence and explicit adjustment methodology.' },
  property_pricing: { capability: 'property_pricing', fallbacks: ['public_reference','customer_evidence','documented_manual_entry'], paidProviderRequired: false, safetySensitive: false, note: 'Use supplier pricing, contractor quotes, historical invoices and regional public data with dated provenance.' },
  weather_catastrophe: { capability: 'weather_catastrophe', fallbacks: ['public_api','public_reference','customer_evidence'], paidProviderRequired: false, safetySensitive: false, note: 'Prefer government weather/disaster datasets such as NOAA/NWS/FEMA where applicable.' },
  codes_regulations: { capability: 'codes_regulations', fallbacks: ['public_reference','customer_evidence','authoritative_evidence_required'], paidProviderRequired: false, safetySensitive: true, note: 'Use official jurisdictional code/regulation sources; do not synthesize a legal requirement from unsupported text.' },
  safety_recalls: { capability: 'safety_recalls', fallbacks: ['public_api','public_reference'], paidProviderRequired: false, safetySensitive: true, note: 'Prefer official NHTSA recall data for supported US vehicles.' },
};

export type FreeFirstCoverageStatus = 'free_covered' | 'customer_evidence_needed' | 'authoritative_evidence_needed';

export type FreeFirstCoverageItem = {
  capability: ProviderCapability;
  status: FreeFirstCoverageStatus;
  providers: string[];
  fallbacks: FreeFirstFallback[];
  note: string;
};

function freeDescriptor(provider: ProviderDescriptor): boolean {
  return provider.licenseRequired === false;
}

export function planFreeFirstCoverage(
  capabilities: Iterable<ProviderCapability>,
  providers: ProviderDescriptor[],
): FreeFirstCoverageItem[] {
  return [...new Set(capabilities)].sort().map(capability => {
    const rule = FREE_FIRST_CAPABILITY_POLICY[capability];
    const freeProviders = providers.filter(provider => freeDescriptor(provider) && provider.capabilities.includes(capability)).map(provider => provider.id);
    if (freeProviders.length) return { capability, status: 'free_covered' as const, providers: freeProviders, fallbacks: rule.fallbacks, note: rule.note };
    const status: FreeFirstCoverageStatus = rule.safetySensitive && rule.fallbacks.includes('authoritative_evidence_required')
      ? 'authoritative_evidence_needed'
      : 'customer_evidence_needed';
    return { capability, status, providers: [], fallbacks: rule.fallbacks, note: rule.note };
  });
}

export function paidProviderIsArchitecturallyRequired(capability: ProviderCapability): false {
  return FREE_FIRST_CAPABILITY_POLICY[capability].paidProviderRequired;
}
