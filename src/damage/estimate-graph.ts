import type { Estimate, EstimateLine, SourceProvenance } from '../domain/types.js';
import type { DamageGraph, DamageGraphEdge, DamageGraphNode } from './graph.js';
import { validateDamageGraph } from './graph.js';

function safeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function provenanceId(line: EstimateLine, source: SourceProvenance, index: number): string {
  return `evidence:${safeId(line.id)}:${safeId(source.provider)}:${index}`;
}

function edge(id: string, from: string, to: string, relation: DamageGraphEdge['relation'], provenanceRefs: string[]): DamageGraphEdge {
  return { id, from, to, relation, provenanceRefs: provenanceRefs.length ? provenanceRefs : ['estimate-line'] };
}

export type EstimateGraphBuildResult = {
  graph: DamageGraph;
  validationErrors: string[];
};

export function buildEstimateIntelligenceGraph(estimate: Estimate): EstimateGraphBuildResult {
  const nodes: DamageGraphNode[] = [{
    id: `asset:${safeId(estimate.id)}`,
    type: 'asset',
    label: [estimate.asset.year, estimate.asset.make, estimate.asset.model].filter(Boolean).join(' ') || estimate.asset.assetClass,
    attributes: { ...estimate.asset, jurisdiction: estimate.jurisdiction, currency: estimate.currency },
  }];
  const edges: DamageGraphEdge[] = [];
  const assetId = nodes[0]!.id;

  for (const line of estimate.lines) {
    const lineKey = safeId(line.id);
    const componentId = `component:${lineKey}`;
    const operationId = `operation:${lineKey}`;
    const priceId = `price:${lineKey}`;
    const evidenceIds: string[] = [];

    nodes.push({
      id: componentId,
      type: 'component',
      label: line.component,
      confidence: line.aiConfidence,
      lineId: line.id,
      attributes: { category: line.category, quantity: line.quantity, unit: line.unit ?? null, safetyCriticalContext: line.safetyCritical ?? false },
    });
    nodes.push({
      id: operationId,
      type: 'operation',
      label: line.operation,
      safetyCritical: line.safetyCritical,
      confidence: line.aiConfidence,
      lineId: line.id,
      attributes: { humanApproved: line.humanApproved, aiSuggested: line.aiSuggested ?? false, laborHours: line.laborHours ?? null },
    });
    nodes.push({
      id: priceId,
      type: 'price',
      label: `${line.total.amountMinor} ${line.total.currency}`,
      lineId: line.id,
      attributes: { total: line.total, laborRate: line.laborRate ?? null, partOrMaterial: line.partOrMaterial ?? null, equipment: line.equipment ?? null, tax: line.tax ?? null },
    });

    line.provenance.forEach((source, index) => {
      const id = provenanceId(line, source, index);
      evidenceIds.push(id);
      nodes.push({
        id,
        type: 'evidence',
        label: source.provider,
        lineId: line.id,
        confidence: source.confidence,
        attributes: { ...source },
      });
    });

    const provenanceRefs = evidenceIds.length ? evidenceIds : [`line:${line.id}`];
    edges.push(edge(`asset-component:${lineKey}`, assetId, componentId, 'contains', provenanceRefs));
    edges.push(edge(`component-operation:${lineKey}`, componentId, operationId, 'requires', provenanceRefs));
    edges.push(edge(`operation-price:${lineKey}`, operationId, priceId, 'priced_by', provenanceRefs));

    for (const evidenceId of evidenceIds) {
      edges.push(edge(`operation-evidence:${lineKey}:${safeId(evidenceId)}`, operationId, evidenceId, 'documented_by', [evidenceId]));
    }

    for (const procedureRef of line.procedureRefs ?? []) {
      const procedureId = `procedure:${lineKey}:${safeId(procedureRef)}`;
      nodes.push({ id: procedureId, type: 'procedure', label: procedureRef, lineId: line.id, attributes: { reference: procedureRef, safetyCriticalContext: line.safetyCritical ?? false } });
      edges.push(edge(`operation-procedure:${lineKey}:${safeId(procedureRef)}`, operationId, procedureId, 'constrained_by', provenanceRefs));
    }

    if (line.operation === 'scan') {
      const diagnosticId = `diagnostic:${lineKey}`;
      nodes.push({ id: diagnosticId, type: 'diagnostic', label: line.component, lineId: line.id, attributes: { safetyCriticalContext: line.safetyCritical ?? false } });
      edges.push(edge(`operation-diagnostic:${lineKey}`, operationId, diagnosticId, 'includes', provenanceRefs));
    }
    if (line.operation === 'calibrate') {
      const calibrationId = `calibration:${lineKey}`;
      nodes.push({ id: calibrationId, type: 'calibration', label: line.component, lineId: line.id, attributes: { safetyCriticalContext: true } });
      edges.push(edge(`operation-calibration:${lineKey}`, operationId, calibrationId, 'includes', provenanceRefs));
    }
    if (line.operation === 'measure') {
      const measurementId = `measurement:${lineKey}`;
      nodes.push({ id: measurementId, type: 'measurement', label: line.component, lineId: line.id, attributes: { safetyCriticalContext: line.safetyCritical ?? false } });
      edges.push(edge(`operation-measurement:${lineKey}`, operationId, measurementId, 'includes', provenanceRefs));
    }
  }

  const graph: DamageGraph = { estimateId: estimate.id, revision: estimate.revision, nodes, edges };
  return { graph, validationErrors: validateDamageGraph(graph) };
}
