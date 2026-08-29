import { createHash } from 'node:crypto';
import type { AssetClass } from '../domain/types.js';
import type { DataQuery, EstimatingDataProvider, ProviderCapability, ProviderDescriptor, ProviderCredentialMode } from './contracts.js';
import { providerCredentialMode } from './contracts.js';
import { certifyProvider, type ProviderCertificationFinding, type ProviderCertificationReport } from './conformance.js';

export type ProviderProductionManifest = {
  version: 1;
  providerId: string;
  agreementReference: string;
  agreementApproved: boolean;
  productionAuthorized: boolean;
  credentialReference: string;
  credentialsProvisioned: boolean;
  credentialScope: ProviderCredentialMode;
  regions: string[];
  assetClasses: AssetClass[];
  capabilities: ProviderCapability[];
  safetyAuthoritativeCapabilities: ProviderCapability[];
  supportReference: string;
  dataRetentionApproved: boolean;
  provenanceRequired: true;
};

export type ProviderProductionCertification = {
  providerId: string;
  green: boolean;
  descriptorHash: string;
  certifiedAt: string;
  manifest: ProviderProductionManifest;
  sampleReports: ProviderCertificationReport[];
  findings: ProviderCertificationFinding[];
};

function hashDescriptor(descriptor: ProviderDescriptor): string {
  const normalized = JSON.stringify({
    id: descriptor.id,
    name: descriptor.name,
    capabilities: [...descriptor.capabilities].sort(),
    regions: [...descriptor.regions].map(region => region.toUpperCase()).sort(),
    licenseRequired: descriptor.licenseRequired,
    tenantScopedCredentials: descriptor.tenantScopedCredentials,
    credentialMode: providerCredentialMode(descriptor),
  });
  return createHash('sha256').update(normalized).digest('hex');
}

function unique(values: string[]): boolean { return new Set(values.map(value => value.toUpperCase())).size === values.length; }

export function validateProviderProductionManifest(manifest: ProviderProductionManifest, descriptor: ProviderDescriptor): ProviderCertificationFinding[] {
  const findings: ProviderCertificationFinding[] = [];
  const block = (code: string, message: string) => findings.push({ severity: 'blocker' as const, code, message });
  if (manifest.version !== 1) block('production.manifest_version', 'provider production manifest version must be 1');
  if (manifest.providerId !== descriptor.id) block('production.provider_id', 'production manifest provider id must match adapter descriptor');
  if (!manifest.agreementReference.trim() || !manifest.agreementApproved) {
    block('production.agreement', descriptor.licenseRequired
      ? 'approved data-rights/license agreement evidence is required'
      : 'approved public/customer data-rights or terms review evidence is required');
  }
  if (!manifest.productionAuthorized) block('production.authorization', 'provider must be explicitly authorized for production use');

  const expectedCredentialMode = providerCredentialMode(descriptor);
  if (manifest.credentialScope !== expectedCredentialMode) block('production.credential_scope', `manifest credential scope must be ${expectedCredentialMode}`);
  if (expectedCredentialMode === 'none') {
    if (manifest.credentialsProvisioned) block('production.credentials_unexpected', 'no-credential provider must not claim provisioned credentials');
    if (manifest.credentialReference.trim()) block('production.credentials_unexpected', 'no-credential provider must not store a credential reference');
  } else {
    if (!manifest.credentialReference.trim() || !manifest.credentialsProvisioned) block('production.credentials', 'provisioned credential evidence is required without storing credentials in the manifest');
  }

  if (manifest.regions.length === 0 || manifest.regions.some(region => !region.trim()) || !unique(manifest.regions)) block('production.regions', 'unique non-empty certified regions are required');
  for (const region of manifest.regions) if (!descriptor.regions.includes('*') && !descriptor.regions.some(value => value.toUpperCase() === region.toUpperCase())) block('production.region_unsupported', `manifest region ${region} is not declared by provider`);
  if (manifest.assetClasses.length === 0) block('production.asset_classes', 'at least one certified asset class is required');
  if (manifest.capabilities.length === 0 || new Set(manifest.capabilities).size !== manifest.capabilities.length) block('production.capabilities', 'unique certified capabilities are required');
  for (const capability of manifest.capabilities) if (!descriptor.capabilities.includes(capability)) block('production.capability_unsupported', `manifest capability ${capability} is not declared by provider`);
  for (const capability of manifest.safetyAuthoritativeCapabilities) if (!manifest.capabilities.includes(capability)) block('production.safety_scope', `safety-authoritative capability ${capability} must also be certified`);
  if (!manifest.supportReference.trim()) block('production.support', 'production support/escalation or official public-source reference is required');
  if (!manifest.dataRetentionApproved) block('production.retention', 'data retention/usage terms must be approved');
  if (manifest.provenanceRequired !== true) block('production.provenance', 'source provenance must remain mandatory');
  return findings;
}

export async function certifyProviderForProduction(
  provider: EstimatingDataProvider,
  manifest: ProviderProductionManifest,
  sampleQueries: DataQuery[],
  now = new Date(),
): Promise<ProviderProductionCertification> {
  const descriptor = provider.descriptor();
  const findings = validateProviderProductionManifest(manifest, descriptor);
  const block = (code: string, message: string) => findings.push({ severity: 'blocker' as const, code, message });
  const sampleReports: ProviderCertificationReport[] = [];

  if (sampleQueries.length === 0) block('production.samples', 'at least one live certification sample query is required');
  const sampledCapabilities = new Set(sampleQueries.map(query => query.capability));
  for (const capability of manifest.capabilities) if (!sampledCapabilities.has(capability)) block('production.sample_coverage', `certified capability ${capability} requires a live sample query`);

  for (const query of sampleQueries) {
    if (!manifest.capabilities.includes(query.capability)) block('production.sample_scope', `sample capability ${query.capability} is outside manifest scope`);
    if (query.jurisdiction && !manifest.regions.some(region => region === '*' || region.toUpperCase() === query.jurisdiction!.toUpperCase())) block('production.sample_region', `sample jurisdiction ${query.jurisdiction} is outside certified region scope`);
    if (!manifest.assetClasses.includes(query.asset.assetClass)) block('production.sample_asset', `sample asset class ${query.asset.assetClass} is outside certified asset scope`);
    const report = await certifyProvider(provider, query);
    sampleReports.push(report);
    findings.push(...report.findings.map(finding => ({ ...finding, code: `sample.${query.capability}.${finding.code}` })));
  }

  return {
    providerId: descriptor.id,
    green: !findings.some(finding => finding.severity === 'blocker'),
    descriptorHash: hashDescriptor(descriptor),
    certifiedAt: now.toISOString(),
    manifest: structuredClone(manifest),
    sampleReports,
    findings,
  };
}

export function assertProviderProductionCertified(certification: ProviderProductionCertification): void {
  if (!certification.green) {
    const blockers = certification.findings.filter(finding => finding.severity === 'blocker').map(finding => finding.code);
    throw new Error(`provider_production_certification_failed:${blockers.join('|')}`);
  }
}
