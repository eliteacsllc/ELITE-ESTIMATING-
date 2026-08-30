import type { ProviderCapability, ProviderDescriptor } from './contracts.js';

export type SourceAuthority = 'government' | 'oem' | 'standards_body' | 'licensed_aggregator' | 'customer' | 'public_reference';
export type SourceAccess = 'public_api' | 'public_download' | 'public_linkout' | 'licensed_api' | 'licensed_portal' | 'customer_upload';
export type SourceRisk = 'low' | 'moderate' | 'safety_critical';

export type GlobalEstimatingSource = {
  id: string;
  name: string;
  authority: SourceAuthority;
  access: SourceAccess;
  regions: string[];
  capabilities: ProviderCapability[];
  risk: SourceRisk;
  mayCache: boolean;
  requiresAgreement: boolean;
  authoritativeForFinalRepairDecision: boolean;
  notes: string;
};

export const GLOBAL_ESTIMATING_SOURCES: GlobalEstimatingSource[] = [
  {
    id: 'nhtsa-vpic', name: 'NHTSA vPIC', authority: 'government', access: 'public_api', regions: ['US'],
    capabilities: ['asset_identity','build_configuration'], risk: 'low', mayCache: true, requiresAgreement: false,
    authoritativeForFinalRepairDecision: false,
    notes: 'Free VIN/manufacturer data. Prefer local PostgreSQL vPIC database for resilience and API-rate avoidance.',
  },
  {
    id: 'nhtsa-recalls', name: 'NHTSA Recalls', authority: 'government', access: 'public_api', regions: ['US'],
    capabilities: ['safety_recalls'], risk: 'moderate', mayCache: true, requiresAgreement: false,
    authoritativeForFinalRepairDecision: false,
    notes: 'Public recall context; not a substitute for OEM repair procedures.',
  },
  {
    id: 'oem1stop', name: 'OEM1Stop', authority: 'oem', access: 'public_linkout', regions: ['US','CA'],
    capabilities: ['oem_procedures','adas_requirements','diagnostics'], risk: 'safety_critical', mayCache: false, requiresAgreement: false,
    authoritativeForFinalRepairDecision: false,
    notes: 'Discovery/linking layer only. Final procedures remain on each manufacturer portal and may require a subscription.',
  },
  {
    id: 'icar-rts', name: 'I-CAR RTS', authority: 'standards_body', access: 'public_linkout', regions: ['US'],
    capabilities: ['adas_requirements','oem_procedures','diagnostics'], risk: 'safety_critical', mayCache: false, requiresAgreement: false,
    authoritativeForFinalRepairDecision: false,
    notes: 'Useful ADAS/OEM research index. Safety-critical execution must be verified against current vehicle-maker technical information.',
  },
  {
    id: 'motor-truspeed-repair', name: 'MOTOR TruSpeed Repair', authority: 'licensed_aggregator', access: 'licensed_api', regions: ['US','CA'],
    capabilities: ['oem_procedures','labor_times','diagnostics','build_configuration'], risk: 'safety_critical', mayCache: false, requiresAgreement: true,
    authoritativeForFinalRepairDecision: true,
    notes: 'Provider adapter slot for licensed OEM-authored repair information and labor/vehicle lookup.',
  },
  {
    id: 'autocare-aces-pies', name: 'Auto Care ACES/PIES', authority: 'standards_body', access: 'licensed_api', regions: ['US','CA','MX','LATAM'],
    capabilities: ['parts','build_configuration'], risk: 'moderate', mayCache: false, requiresAgreement: true,
    authoritativeForFinalRepairDecision: false,
    notes: 'Use current schemas for normalized fitment/product interchange. Supporting reference databases require subscription.',
  },
  {
    id: 'tecdoc', name: 'TecDoc / TecAlliance', authority: 'licensed_aggregator', access: 'licensed_api', regions: ['EU','UK','MEA','APAC','LATAM'],
    capabilities: ['parts','build_configuration'], risk: 'moderate', mayCache: false, requiresAgreement: true,
    authoritativeForFinalRepairDecision: false,
    notes: 'Global parts/fitment adapter slot. Activate only under provider terms for each market.',
  },
  {
    id: 'customer-evidence', name: 'Customer-owned evidence', authority: 'customer', access: 'customer_upload', regions: ['*'],
    capabilities: ['asset_identity','build_configuration','parts','labor_times','labor_rates','materials','market_pricing','oem_procedures','adas_requirements','diagnostics','valuation','property_pricing','weather_catastrophe','codes_regulations','safety_recalls'],
    risk: 'moderate', mayCache: true, requiresAgreement: false, authoritativeForFinalRepairDecision: false,
    notes: 'Lawful fallback for user-supplied invoices, OEM PDFs, scan reports, photos, measurements, quotes and market evidence; provenance is mandatory.',
  },
];

export function sourcesForCapability(capability: ProviderCapability, region = '*'): GlobalEstimatingSource[] {
  return GLOBAL_ESTIMATING_SOURCES.filter(source =>
    source.capabilities.includes(capability) && (source.regions.includes('*') || source.regions.includes(region)),
  );
}

export function sourceDescriptor(source: GlobalEstimatingSource): ProviderDescriptor {
  return {
    id: source.id,
    name: source.name,
    capabilities: source.capabilities,
    regions: source.regions,
    licenseRequired: source.requiresAgreement,
    tenantScopedCredentials: source.requiresAgreement,
    credentialMode: source.requiresAgreement ? 'api_key' : 'none',
  };
}

export type SourceActivationDecision = {
  sourceId: string;
  usable: boolean;
  mode: 'automatic' | 'linkout' | 'customer_evidence' | 'provider_agreement_required';
  reason: string;
};

export function planSourceActivation(source: GlobalEstimatingSource, hasProviderAgreement = false): SourceActivationDecision {
  if (source.requiresAgreement && !hasProviderAgreement) {
    return { sourceId: source.id, usable: false, mode: 'provider_agreement_required', reason: 'Provider terms/credentials must be completed before production retrieval.' };
  }
  if (source.access === 'public_linkout') {
    return { sourceId: source.id, usable: true, mode: 'linkout', reason: 'Use as a discovery/deep-link source without copying restricted content.' };
  }
  if (source.access === 'customer_upload') {
    return { sourceId: source.id, usable: true, mode: 'customer_evidence', reason: 'Accept tenant-owned evidence with immutable provenance and review.' };
  }
  return { sourceId: source.id, usable: true, mode: 'automatic', reason: 'Source can be queried automatically subject to its published access conditions.' };
}
