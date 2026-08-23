export type DamageNodeType =
  | 'asset'
  | 'component'
  | 'damage'
  | 'operation'
  | 'dependency'
  | 'part_material'
  | 'procedure'
  | 'price'
  | 'adas_safety'
  | 'evidence';

export type DamageRelation =
  | 'contains'
  | 'observed_on'
  | 'supports'
  | 'requires'
  | 'includes'
  | 'excludes'
  | 'triggers'
  | 'priced_by'
  | 'documented_by'
  | 'validated_by';

export type DamageGraphNode = {
  id: string;
  type: DamageNodeType;
  label: string;
  safetyCritical?: boolean;
  attributes: Record<string, unknown>;
};

export type DamageGraphEdge = {
  id: string;
  from: string;
  to: string;
  relation: DamageRelation;
  provenanceRefs: string[];
};

export type DamageGraph = {
  estimateId: string;
  revision: number;
  nodes: DamageGraphNode[];
  edges: DamageGraphEdge[];
};

export function validateDamageGraph(graph: DamageGraph): string[] {
  const errors: string[] = [];
  const nodes = new Map<string, DamageGraphNode>();
  const edgeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id.trim()) errors.push('damage_graph_node_id_required');
    if (nodes.has(node.id)) errors.push(`duplicate_damage_node:${node.id}`);
    nodes.set(node.id, node);
  }
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) errors.push(`duplicate_damage_edge:${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodes.has(edge.from)) errors.push(`damage_edge_missing_from:${edge.id}`);
    if (!nodes.has(edge.to)) errors.push(`damage_edge_missing_to:${edge.id}`);
    if (edge.provenanceRefs.length === 0) errors.push(`damage_edge_provenance_required:${edge.id}`);
  }
  if (![...nodes.values()].some(node => node.type === 'asset')) errors.push('damage_graph_asset_required');

  for (const node of nodes.values()) {
    if (!node.safetyCritical) continue;
    const connected = graph.edges.filter(edge => edge.from === node.id || edge.to === node.id);
    const relatedNodes = connected.flatMap(edge => [nodes.get(edge.from), nodes.get(edge.to)]).filter((value): value is DamageGraphNode => Boolean(value));
    if (!relatedNodes.some(related => related.type === 'procedure')) errors.push(`safety_node_procedure_required:${node.id}`);
    if (!relatedNodes.some(related => related.type === 'evidence')) errors.push(`safety_node_evidence_required:${node.id}`);
  }
  return errors;
}

export function traceEvidence(graph: DamageGraph, startNodeId: string, maxDepth = 8): DamageGraphNode[] {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (!nodes.has(startNodeId)) throw new Error('damage_graph_start_node_missing');
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
  }
  const found = new Map<string, DamageGraphNode>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.id) || current.depth > maxDepth) continue;
    visited.add(current.id);
    const node = nodes.get(current.id);
    if (node?.type === 'evidence' || node?.type === 'procedure') found.set(node.id, node);
    for (const next of adjacency.get(current.id) ?? []) queue.push({ id: next, depth: current.depth + 1 });
  }
  return [...found.values()];
}
