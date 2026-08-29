import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderDescriptor } from '../connectors/contracts.js';
import { FREE_FIRST_PROVIDER_DESCRIPTORS } from '../connectors/open-data.js';
import { paidProviderIsArchitecturallyRequired, planFreeFirstCoverage } from './free-first.js';

test('no estimating capability is architecturally locked to a paid provider', () => {
  for (const capability of ['asset_identity','build_configuration','parts','labor_times','labor_rates','materials','market_pricing','oem_procedures','adas_requirements','diagnostics','valuation','property_pricing','weather_catastrophe','codes_regulations','safety_recalls'] as const) {
    assert.equal(paidProviderIsArchitecturallyRequired(capability), false);
  }
});

test('public NHTSA capabilities are free-covered while unsupported safety evidence fails to an authoritative evidence requirement', () => {
  const plan = planFreeFirstCoverage(['asset_identity','build_configuration','safety_recalls','oem_procedures','labor_times'], FREE_FIRST_PROVIDER_DESCRIPTORS);
  const byCapability = new Map(plan.map(item => [item.capability, item]));
  assert.equal(byCapability.get('asset_identity')?.status, 'free_covered');
  assert.equal(byCapability.get('build_configuration')?.status, 'free_covered');
  assert.equal(byCapability.get('safety_recalls')?.status, 'free_covered');
  assert.equal(byCapability.get('oem_procedures')?.status, 'authoritative_evidence_needed');
  assert.equal(byCapability.get('labor_times')?.status, 'customer_evidence_needed');
});

test('customer-owned adapters can satisfy capabilities without changing the free-first policy', () => {
  const customer: ProviderDescriptor = {
    id: 'customer-evidence',
    name: 'Customer-owned evidence',
    capabilities: ['oem_procedures','labor_times'],
    regions: ['*'],
    licenseRequired: false,
    tenantScopedCredentials: false,
    credentialMode: 'none',
  };
  const plan = planFreeFirstCoverage(['oem_procedures','labor_times'], [...FREE_FIRST_PROVIDER_DESCRIPTORS, customer]);
  assert.equal(plan.find(item => item.capability === 'oem_procedures')?.status, 'free_covered');
  assert.equal(plan.find(item => item.capability === 'labor_times')?.status, 'free_covered');
});
