import test from 'node:test';
import assert from 'node:assert/strict';
import { traceEvidence, validateDamageGraph, type DamageGraph } from './graph.js';

function safeGraph(): DamageGraph {
  return {
    estimateId: 'estimate-1',
    revision: 1,
    nodes: [
      { id: 'asset', type: 'asset', label: 'Vehicle', attributes: {} },
      { id: 'radar', type: 'adas_safety', label: 'Front radar', safetyCritical: true, attributes: {} },
      { id: 'procedure', type: 'procedure', label: 'OEM calibration procedure', attributes: {} },
      { id: 'evidence', type: 'evidence', label: 'Calibration report', attributes: {} },
    ],
    edges: [
      { id: 'e1', from: 'asset', to: 'radar', relation: 'contains', provenanceRefs: ['asset-build'] },
      { id: 'e2', from: 'radar', to: 'procedure', relation: 'requires', provenanceRefs: ['oem-procedure'] },
      { id: 'e3', from: 'radar', to: 'evidence', relation: 'validated_by', provenanceRefs: ['scan-report'] },
    ],
  };
}

test('safety-critical graph requires procedure and evidence paths', () => {
  assert.deepEqual(validateDamageGraph(safeGraph()), []);
});

test('safety graph fails when evidence is absent', () => {
  const graph = safeGraph();
  graph.nodes = graph.nodes.filter(node => node.id !== 'evidence');
  graph.edges = graph.edges.filter(edge => edge.to !== 'evidence');
  assert.ok(validateDamageGraph(graph).includes('safety_node_evidence_required:radar'));
});

test('traceEvidence returns procedure and evidence nodes', () => {
  const traced = traceEvidence(safeGraph(), 'radar');
  assert.deepEqual(new Set(traced.map(node => node.type)), new Set(['procedure', 'evidence']));
});

test('every graph edge requires provenance', () => {
  const graph = safeGraph();
  graph.edges[0]!.provenanceRefs = [];
  assert.ok(validateDamageGraph(graph).includes('damage_edge_provenance_required:e1'));
});
