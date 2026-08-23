import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import type { DamageGraph } from './graph.js';
import { InMemoryDamageGraphRepository } from './repository.js';
import { DamageGraphService } from './service.js';

const estimator: Principal = { userId: 'u1', tenantId: 't1', roles: ['estimator'] };

async function fixture() {
  const estimates = new InMemoryEstimateRepository();
  const estimating = new EstimatingService(estimates);
  const estimate = await estimating.create(estimator, {
    tenantId: estimator.tenantId,
    asset: { assetClass: 'passenger_vehicle', vin: 'JTMAB3FV0PD000001' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US-FL',
  });
  return { estimate, service: new DamageGraphService(estimates, new InMemoryDamageGraphRepository()) };
}

function graph(estimateId: string, revision: number): DamageGraph {
  return {
    estimateId,
    revision,
    nodes: [
      { id: 'asset', type: 'asset', label: 'Vehicle', attributes: {} },
      { id: 'damage', type: 'damage', label: 'Front impact', attributes: {} },
    ],
    edges: [{ id: 'edge-1', from: 'asset', to: 'damage', relation: 'observed_on', provenanceRefs: ['inspection:1'] }],
  };
}

test('damage graph saves and reads by current revision', async () => {
  const { estimate, service } = await fixture();
  const saved = await service.save(estimator, estimate.id, graph(estimate.id, estimate.revision));
  assert.equal(saved.revision, 1);
  assert.deepEqual(await service.get(estimator, estimate.id), saved);
});

test('damage graph rejects stale revision and cross-tenant reads', async () => {
  const { estimate, service } = await fixture();
  await assert.rejects(() => service.save(estimator, estimate.id, graph(estimate.id, estimate.revision + 1)), /stale_damage_graph_revision/);
  const other: Principal = { userId: 'u2', tenantId: 't2', roles: ['estimator'] };
  await assert.rejects(() => service.get(other, estimate.id), /estimate_not_found/);
});

test('damage graph validates safety evidence before persistence', async () => {
  const { estimate, service } = await fixture();
  const invalid = graph(estimate.id, estimate.revision);
  invalid.nodes.push({ id: 'adas', type: 'adas_safety', label: 'Radar calibration', safetyCritical: true, attributes: {} });
  invalid.edges.push({ id: 'edge-2', from: 'damage', to: 'adas', relation: 'triggers', provenanceRefs: ['inspection:1'] });
  await assert.rejects(() => service.save(estimator, estimate.id, invalid), /safety_node_procedure_required/);
});
