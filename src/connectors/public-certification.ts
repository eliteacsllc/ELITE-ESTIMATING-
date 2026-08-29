import type { AssetClass } from '../domain/types.js';
import type { ProviderCapability } from './contracts.js';
import type { ProviderProductionManifest } from './production-certification.js';

export type PublicProviderId = 'nhtsa-vpic' | 'nhtsa-recalls' | 'openfema-disasters' | 'nws-alerts';

export type PublicCertificationApproval = {
  termsApproved: boolean;
  productionAuthorized: boolean;
  retentionApproved: boolean;
};

type TemplateDefinition = {
  regions: string[];
  assetClasses: AssetClass[];
  capabilities: ProviderCapability[];
  safetyAuthoritativeCapabilities: ProviderCapability[];
  termsReference: string;
  supportReference: string;
};

const TEMPLATES: Readonly<Record<PublicProviderId, TemplateDefinition>> = {
  'nhtsa-vpic': {
    regions: ['US'],
    assetClasses: ['passenger_vehicle','commercial_vehicle','tractor_trailer','motorcycle','rv','ambulance_emergency'],
    capabilities: ['asset_identity','build_configuration'],
    safetyAuthoritativeCapabilities: [],
    termsReference: 'official-public-source:nhtsa-vpic',
    supportReference: 'official-source:https://vpic.nhtsa.dot.gov/api/',
  },
  'nhtsa-recalls': {
    regions: ['US'],
    assetClasses: ['passenger_vehicle','commercial_vehicle','tractor_trailer','motorcycle','rv','ambulance_emergency'],
    capabilities: ['safety_recalls'],
    safetyAuthoritativeCapabilities: ['safety_recalls'],
    termsReference: 'official-public-source:nhtsa-recalls',
    supportReference: 'official-source:https://api.nhtsa.gov/',
  },
  'openfema-disasters': {
    regions: ['US'],
    assetClasses: ['residential_property','commercial_property'],
    capabilities: ['weather_catastrophe'],
    safetyAuthoritativeCapabilities: [],
    termsReference: 'official-public-source:openfema',
    supportReference: 'official-source:https://www.fema.gov/about/openfema/api',
  },
  'nws-alerts': {
    regions: ['US'],
    assetClasses: ['residential_property','commercial_property','passenger_vehicle','commercial_vehicle','tractor_trailer','rv','ambulance_emergency'],
    capabilities: ['weather_catastrophe'],
    safetyAuthoritativeCapabilities: [],
    termsReference: 'official-public-source:nws-api',
    supportReference: 'official-source:https://www.weather.gov/documentation/services-web-api',
  },
};

export function publicProviderProductionManifest(
  providerId: PublicProviderId,
  approval: PublicCertificationApproval,
  scope?: Partial<Pick<ProviderProductionManifest, 'regions' | 'assetClasses' | 'capabilities' | 'safetyAuthoritativeCapabilities'>>,
): ProviderProductionManifest {
  const template = TEMPLATES[providerId];
  const capabilities = scope?.capabilities ?? template.capabilities;
  const safetyAuthoritativeCapabilities = scope?.safetyAuthoritativeCapabilities ?? template.safetyAuthoritativeCapabilities.filter(capability => capabilities.includes(capability));
  return {
    version: 1,
    providerId,
    agreementReference: template.termsReference,
    agreementApproved: approval.termsApproved,
    productionAuthorized: approval.productionAuthorized,
    credentialReference: '',
    credentialsProvisioned: false,
    credentialScope: 'none',
    regions: scope?.regions ?? [...template.regions],
    assetClasses: scope?.assetClasses ?? [...template.assetClasses],
    capabilities: [...capabilities],
    safetyAuthoritativeCapabilities: [...safetyAuthoritativeCapabilities],
    supportReference: template.supportReference,
    dataRetentionApproved: approval.retentionApproved,
    provenanceRequired: true,
  };
}

export function listPublicCertificationTemplates(): PublicProviderId[] {
  return Object.keys(TEMPLATES).sort() as PublicProviderId[];
}
