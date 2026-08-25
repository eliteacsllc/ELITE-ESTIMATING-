import test from 'node:test';
import assert from 'node:assert/strict';
import type { DataQuery, EstimatingDataProvider, ProviderDescriptor, ProviderRecord } from './contracts.js';
import { certifyProviderForProduction, type ProviderProductionManifest } from './production-certification.js';

const descriptor: ProviderDescriptor = {
  id: 'licensed-oem', name: 'Licensed OEM', capabilities: ['oem_procedures','adas_requirements'], regions: ['US'], licenseRequired: true, tenantScopedCredentials: true,
};

class MockProvider implements EstimatingDataProvider {
  descriptor(): ProviderDescriptor { return descriptor; }
  supports(query: DataQuery): boolean { return descriptor.capabilities.includes(query.capability) && query.jurisdiction === 'US'; }
  async query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    return [{ value: { capability: query.capability } as T, provenance: { provider: descriptor.id, retrievedAt: new Date().toISOString(), licenseClass: 'licensed', region: 'US', confidence: 1 } }];
  }
  async health(): Promise<{ ok: boolean; latencyMs?: number }> { return { ok: true, latencyMs: 10 }; }
}

function manifest(): ProviderProductionManifest {
  return {
    version: 1,
    providerId: descriptor.id,
    agreementReference: 'contract-2026-001', agreementApproved: true, productionAuthorized: true,
    credentialReference: 'vault://provider/licensed-oem', credentialsProvisioned: true, credentialScope: 'tenant',
    regions: ['US'], assetClasses: ['passenger_vehicle'], capabilities: ['oem_procedures','adas_requirements'],
    safetyAuthoritativeCapabilities: ['oem_procedures','adas_requirements'], supportReference: 'vendor-support-plan-1', dataRetentionApproved: true, provenanceRequired: true,
  };
}

const samples: DataQuery[] = [
  { tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle', vin: '1TEST' }, capability: 'oem_procedures', jurisdiction: 'US' },
  { tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle', vin: '1TEST' }, capability: 'adas_requirements', jurisdiction: 'US' },
];

test('production provider certification requires live coverage for all certified capabilities', async () => {
  const result = await certifyProviderForProduction(new MockProvider(), manifest(), samples, new Date('2026-08-25T12:00:00Z'));
  assert.equal(result.green, true);
  assert.equal(result.sampleReports.length, 2);
  assert.match(result.descriptorHash, /^[0-9a-f]{64}$/);
});

test('production provider certification blocks missing agreement and capability sample', async () => {
  const bad = manifest();
  bad.agreementApproved = false;
  const result = await certifyProviderForProduction(new MockProvider(), bad, samples.slice(0, 1));
  assert.equal(result.green, false);
  assert.ok(result.findings.some(finding => finding.code === 'production.agreement'));
  assert.ok(result.findings.some(finding => finding.code === 'production.sample_coverage'));
});
