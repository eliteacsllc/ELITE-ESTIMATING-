import assert from 'node:assert/strict';
import test from 'node:test';
import type { VisualIntelligenceProvider } from './visual-provider.js';
import { certifyVisualProvider } from './visual-provider.js';

const request = {
  tenantId: 'tenant-a', estimateId: 'estimate-1', asset: { assetClass: 'passenger_vehicle' as const },
  evidence: [{ evidenceId: 'photo-1', mediaType: 'image/jpeg' as const, sha256: 'a'.repeat(64) }],
};

function provider(overrides: Partial<VisualIntelligenceProvider> = {}): VisualIntelligenceProvider {
  return {
    id: 'local-vision', deployment: 'local', supports: () => true,
    health: async () => ({ ok: true, version: '1.0.0' }),
    analyze: async () => ({
      providerId: 'local-vision', modelId: 'damage-model', modelVersion: '1.0.0', analyzedAt: '2026-08-30T00:00:00Z',
      observations: [{ id: 'obs-1', component: 'door', category: 'body', severity: 'minor', confidence: 0.98, provenance: [{ provider: 'local-vision', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'owned', confidence: 0.98 }] }],
      warnings: [],
    }),
    ...overrides,
  };
}

test('healthy provider with model identity and provenance certifies green', async () => {
  const result = await certifyVisualProvider(provider(), request);
  assert.equal(result.green, true, result.blockers.join(','));
  assert.equal(result.observationCount, 1);
});

test('provider cannot return observations without provider provenance', async () => {
  const bad = provider({ analyze: async () => ({ providerId: 'local-vision', modelId: 'damage-model', modelVersion: '1.0.0', analyzedAt: '2026-08-30T00:00:00Z', observations: [{ id: 'obs-1', component: 'door', category: 'body', severity: 'minor', confidence: 0.9, provenance: [] }], warnings: [] }) });
  const result = await certifyVisualProvider(bad, request);
  assert.equal(result.green, false);
  assert.ok(result.blockers.includes('visual_observation_provenance_missing'));
});

test('invalid evidence hash fails before provider execution', async () => {
  let called = false;
  const result = await certifyVisualProvider(provider({ analyze: async () => { called = true; throw new Error('should_not_run'); } }), { ...request, evidence: [{ ...request.evidence[0]!, sha256: 'bad' }] });
  assert.equal(result.green, false);
  assert.equal(called, false);
  assert.ok(result.blockers.includes('visual_evidence_integrity_invalid'));
});
