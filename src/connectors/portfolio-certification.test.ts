import test from 'node:test';
import assert from 'node:assert/strict';
import { certifyProviderPortfolio } from './portfolio-certification.js';
import type { ProviderProductionCertification } from './production-certification.js';

function certification(providerId: string, capability: 'parts' | 'oem_procedures', assetClass: 'passenger_vehicle' | 'commercial_vehicle', region = 'US'): ProviderProductionCertification {
  return {
    providerId,
    green: true,
    descriptorHash: 'a'.repeat(64),
    certifiedAt: '2026-08-25T12:00:00Z',
    manifest: {
      version: 1,
      providerId,
      agreementReference: 'agreement', agreementApproved: true, productionAuthorized: true,
      credentialReference: 'vault://ref', credentialsProvisioned: true, credentialScope: 'platform',
      regions: [region], assetClasses: [assetClass], capabilities: [capability], safetyAuthoritativeCapabilities: capability === 'oem_procedures' ? [capability] : [],
      supportReference: 'support', dataRetentionApproved: true, provenanceRequired: true,
    },
    sampleReports: [], findings: [],
  };
}

test('provider portfolio requires complete capability coverage for asset and region', () => {
  const result = certifyProviderPortfolio(
    [{ assetClass: 'passenger_vehicle', region: 'US', capabilities: ['parts','oem_procedures'] }],
    [certification('parts-us', 'parts', 'passenger_vehicle'), certification('oem-us', 'oem_procedures', 'passenger_vehicle')],
  );
  assert.equal(result.green, true);
  assert.deepEqual(result.gaps, []);
});

test('certified provider for wrong asset class cannot fill portfolio gap', () => {
  const result = certifyProviderPortfolio(
    [{ assetClass: 'passenger_vehicle', region: 'US', capabilities: ['parts'] }],
    [certification('truck-parts', 'parts', 'commercial_vehicle')],
  );
  assert.equal(result.green, false);
  assert.equal(result.gaps[0]?.capability, 'parts');
});
