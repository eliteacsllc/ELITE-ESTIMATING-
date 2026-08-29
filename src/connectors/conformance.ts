import type { EstimatingDataProvider, DataQuery, ProviderDescriptor, ProviderCapability } from './contracts.js';
import { providerCredentialMode } from './contracts.js';

export type ProviderCertificationFinding = {
  severity: 'blocker' | 'warning';
  code: string;
  message: string;
};

export type ProviderCertificationReport = {
  providerId: string;
  green: boolean;
  findings: ProviderCertificationFinding[];
};

const CAPABILITIES = new Set<ProviderCapability>([
  'asset_identity','build_configuration','parts','labor_times','labor_rates','materials','market_pricing',
  'oem_procedures','adas_requirements','diagnostics','valuation','property_pricing','weather_catastrophe','codes_regulations','safety_recalls',
]);

function validDescriptor(descriptor: ProviderDescriptor, findings: ProviderCertificationFinding[]): void {
  const block = (code: string, message: string) => findings.push({ severity: 'blocker', code, message });
  if (!descriptor.id.trim() || !/^[a-z0-9][a-z0-9._-]*$/i.test(descriptor.id)) block('descriptor.id', 'provider id must be a stable non-empty identifier');
  if (!descriptor.name.trim()) block('descriptor.name', 'provider name is required');
  if (descriptor.capabilities.length === 0) block('descriptor.capabilities', 'at least one capability is required');
  if (new Set(descriptor.capabilities).size !== descriptor.capabilities.length) block('descriptor.capabilities_duplicate', 'capabilities must be unique');
  for (const capability of descriptor.capabilities) if (!CAPABILITIES.has(capability)) block('descriptor.capability_unknown', `unsupported capability ${String(capability)}`);
  if (descriptor.regions.length === 0) block('descriptor.regions', 'at least one supported region is required');
  if (descriptor.regions.some(region => !region.trim())) block('descriptor.region_blank', 'regions cannot contain blank values');
  if (new Set(descriptor.regions.map(r => r.toUpperCase())).size !== descriptor.regions.length) block('descriptor.regions_duplicate', 'regions must be unique case-insensitively');
  const credentialMode = providerCredentialMode(descriptor);
  if (credentialMode === 'tenant' && !descriptor.tenantScopedCredentials) block('descriptor.credential_mode', 'tenant credential mode requires tenantScopedCredentials=true');
  if (credentialMode === 'none' && descriptor.tenantScopedCredentials) block('descriptor.credential_mode', 'no-credential provider cannot declare tenant-scoped credentials');
}

export async function certifyProvider(
  provider: EstimatingDataProvider,
  sampleQuery: DataQuery,
): Promise<ProviderCertificationReport> {
  const findings: ProviderCertificationFinding[] = [];
  const block = (code: string, message: string) => findings.push({ severity: 'blocker', code, message });
  const warn = (code: string, message: string) => findings.push({ severity: 'warning', code, message });

  const descriptor = provider.descriptor();
  validDescriptor(descriptor, findings);

  if (!descriptor.capabilities.includes(sampleQuery.capability)) block('supports.capability', 'sample query capability is not declared by descriptor');
  const region = sampleQuery.jurisdiction?.toUpperCase();
  if (region && !descriptor.regions.some(r => r.toUpperCase() === region || r === '*')) warn('supports.region', 'sample jurisdiction is not explicitly declared by descriptor');

  const supports = provider.supports(sampleQuery);
  if (!supports) block('supports.sample', 'provider must support its certification sample query');

  try {
    const health = await provider.health();
    if (!health.ok) block('health.unhealthy', health.message || 'provider health check reported unhealthy');
    if (health.latencyMs !== undefined && (!Number.isFinite(health.latencyMs) || health.latencyMs < 0)) block('health.latency', 'health latency must be a non-negative finite number');
  } catch (error) {
    block('health.exception', `provider health check threw: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (supports) {
    try {
      const records = await provider.query(sampleQuery);
      for (const [index, record] of records.entries()) {
        const p = record.provenance;
        if (!p.provider.trim()) block('provenance.provider', `record ${index} is missing provider provenance`);
        if (p.provider !== descriptor.id && p.provider !== descriptor.name) warn('provenance.provider_mismatch', `record ${index} provenance provider does not match descriptor id/name`);
        if (!p.retrievedAt || Number.isNaN(Date.parse(p.retrievedAt))) block('provenance.retrievedAt', `record ${index} has invalid retrievedAt`);
        if (!['owned','licensed','public','customer_provided'].includes(p.licenseClass)) block('provenance.licenseClass', `record ${index} has invalid license class`);
        if (descriptor.licenseRequired && p.licenseClass === 'public') block('provenance.license_mismatch', `record ${index} is marked public for a license-required provider`);
        if (p.confidence !== undefined && (p.confidence < 0 || p.confidence > 1 || !Number.isFinite(p.confidence))) block('provenance.confidence', `record ${index} confidence must be between 0 and 1`);
      }
    } catch (error) {
      block('query.exception', `provider sample query threw: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (providerCredentialMode(descriptor) === 'tenant' && !sampleQuery.tenantId.trim()) block('tenant.credentials', 'tenant-scoped provider certification requires a tenant id');

  return { providerId: descriptor.id, green: !findings.some(f => f.severity === 'blocker'), findings };
}
