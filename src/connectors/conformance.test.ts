import assert from 'node:assert/strict';
import test from 'node:test';
import type { EstimatingDataProvider, DataQuery } from './contracts.js';
import { certifyProvider } from './conformance.js';

const sample: DataQuery = {
  tenantId: 'tenant-1',
  asset: { assetClass: 'passenger_vehicle', year: 2026, make: 'Example', model: 'Vehicle' },
  capability: 'oem_procedures',
  jurisdiction: 'US',
};

function provider(overrides: Partial<EstimatingDataProvider> = {}): EstimatingDataProvider {
  return {
    descriptor: () => ({
      id: 'licensed-oem',
      name: 'Licensed OEM',
      capabilities: ['oem_procedures'],
      regions: ['US'],
      licenseRequired: true,
      tenantScopedCredentials: true,
    }),
    supports: () => true,
    health: async () => ({ ok: true, latencyMs: 12 }),
    query: async () => ([{
      value: { procedureId: 'proc-1' },
      provenance: {
        provider: 'licensed-oem',
        sourceId: 'proc-1',
        retrievedAt: new Date().toISOString(),
        region: 'US',
        licenseClass: 'licensed' as const,
        confidence: 0.99,
      },
    }]),
    ...overrides,
  };
}

test('valid licensed provider certifies green', async () => {
  const report = await certifyProvider(provider(), sample);
  assert.equal(report.green, true);
  assert.equal(report.findings.filter(f => f.severity === 'blocker').length, 0);
});

test('licensed provider cannot label returned data public', async () => {
  const p = provider({
    query: async () => ([{
      value: {},
      provenance: { provider: 'licensed-oem', retrievedAt: new Date().toISOString(), licenseClass: 'public' as const },
    }]),
  });
  const report = await certifyProvider(p, sample);
  assert.equal(report.green, false);
  assert.ok(report.findings.some(f => f.code === 'provenance.license_mismatch'));
});

test('provider health failure blocks certification', async () => {
  const report = await certifyProvider(provider({ health: async () => ({ ok: false, message: 'upstream unavailable' }) }), sample);
  assert.equal(report.green, false);
  assert.ok(report.findings.some(f => f.code === 'health.unhealthy'));
});

test('provider must support certification sample', async () => {
  const report = await certifyProvider(provider({ supports: () => false }), sample);
  assert.equal(report.green, false);
  assert.ok(report.findings.some(f => f.code === 'supports.sample'));
});

test('invalid confidence is rejected', async () => {
  const p = provider({
    query: async () => ([{
      value: {},
      provenance: { provider: 'licensed-oem', retrievedAt: new Date().toISOString(), licenseClass: 'licensed' as const, confidence: 1.2 },
    }]),
  });
  const report = await certifyProvider(p, sample);
  assert.equal(report.green, false);
  assert.ok(report.findings.some(f => f.code === 'provenance.confidence'));
});
