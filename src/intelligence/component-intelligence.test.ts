import test from 'node:test';
import assert from 'node:assert/strict';
import type { Estimate } from '../domain/types.js';
import { buildComponentIntelligenceWorkspace } from './component-intelligence.js';

function estimate(): Estimate {
  return {
    id: 'estimate-1',
    tenantId: 'tenant-1',
    asset: { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352', year: 2025, make: 'Example', model: 'Vehicle' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US-MD',
    lines: [{
      id: 'line-1',
      category: 'Rear bumper',
      component: 'Parking sensor',
      operation: 'replace',
      quantity: 1,
      laborHours: 0.5,
      partOrMaterial: { amountMinor: 12500, currency: 'USD' },
      total: { amountMinor: 17500, currency: 'USD' },
      procedureRefs: ['OEM-SENSOR-001'],
      safetyCritical: true,
      aiSuggested: true,
      aiConfidence: 0.91,
      humanApproved: false,
      provenance: [{
        provider: 'damage-iq',
        sourceId: 'photo-14',
        retrievedAt: '2026-10-04T06:00:00Z',
        licenseClass: 'owned',
        confidence: 0.96,
      }],
    }],
    subtotal: { amountMinor: 17500, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 17500, currency: 'USD' },
    status: 'draft',
    revision: 1,
    createdAt: '2026-10-04T06:00:00Z',
    updatedAt: '2026-10-04T06:00:00Z',
  };
}

test('component intelligence combines graph, provenance, and completeness review', () => {
  const workspace = buildComponentIntelligenceWorkspace(estimate());
  assert.equal(workspace.components.length, 1);
  const component = workspace.components[0]!;
  assert.equal(component.component, 'Parking sensor');
  assert.equal(component.evidence[0]?.provider, 'damage-iq');
  assert.equal(component.related.procedures[0], 'OEM-SENSOR-001');
  assert.equal(component.releaseState, 'human_review_required');
  assert.ok(component.reviewCandidates.some(candidate => candidate.code === 'review:diagnostic_scan'));
  assert.ok(component.reviewCandidates.some(candidate => candidate.code === 'review:calibration'));
  assert.equal(workspace.summary.humanReviewRequired, 1);
});
