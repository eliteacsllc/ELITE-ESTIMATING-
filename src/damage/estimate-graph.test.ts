import assert from 'node:assert/strict';
import test from 'node:test';
import type { Estimate } from '../domain/types.js';
import { buildEstimateIntelligenceGraph } from './estimate-graph.js';

function estimate(lineOverrides: Partial<Estimate['lines'][number]> = {}): Estimate {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle', year: 2026, make: 'Example', model: 'Vehicle' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US-DE',
    lines: [{
      id: 'line-1', category: 'body', component: 'front door', operation: 'repair', quantity: 1,
      total: { amountMinor: 12500, currency: 'USD' }, humanApproved: true,
      provenance: [{ provider: 'expert', sourceId: 'case-1', retrievedAt: '2026-08-30T00:00:00Z', licenseClass: 'owned', confidence: 1 }],
      ...lineOverrides,
    }],
    subtotal: { amountMinor: 12500, currency: 'USD' }, tax: { amountMinor: 0, currency: 'USD' }, total: { amountMinor: 12500, currency: 'USD' },
    status: 'draft', revision: 1, createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z',
  };
}

test('builds component operation price and evidence relationships from an estimate', () => {
  const result = buildEstimateIntelligenceGraph(estimate());
  assert.deepEqual(result.validationErrors, []);
  assert.ok(result.graph.nodes.some(node => node.type === 'component' && node.lineId === 'line-1'));
  assert.ok(result.graph.nodes.some(node => node.type === 'operation' && node.lineId === 'line-1'));
  assert.ok(result.graph.nodes.some(node => node.type === 'price' && node.lineId === 'line-1'));
  assert.ok(result.graph.nodes.some(node => node.type === 'evidence' && node.lineId === 'line-1'));
});

test('safety critical line without procedure is visibly uncertified', () => {
  const result = buildEstimateIntelligenceGraph(estimate({ safetyCritical: true, procedureRefs: [] }));
  assert.ok(result.validationErrors.some(error => error.startsWith('safety_node_procedure_required:')));
});

test('safety critical line with evidence and procedure produces a valid graph', () => {
  const result = buildEstimateIntelligenceGraph(estimate({ safetyCritical: true, procedureRefs: ['OEM-ADAS-001'] }));
  assert.deepEqual(result.validationErrors, []);
});
