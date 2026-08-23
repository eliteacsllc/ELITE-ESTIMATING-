import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { DamageGraph } from './graph.js';
import { validateDamageGraph } from './graph.js';
import type { DamageGraphRepository } from './repository.js';

export class DamageGraphService {
  constructor(
    private readonly estimates: EstimateRepository,
    private readonly graphs: DamageGraphRepository,
  ) {}

  async save(principal: Principal, estimateId: string, graph: DamageGraph): Promise<DamageGraph> {
    authorize(principal, 'estimate:update', principal.tenantId);
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
    if (graph.estimateId !== estimateId) throw new Error('damage_graph_estimate_mismatch');
    if (graph.revision !== estimate.revision) throw new Error('stale_damage_graph_revision');
    const errors = validateDamageGraph(graph);
    if (errors.length) throw new Error(`damage_graph_invalid:${errors.join('|')}`);
    return this.graphs.save(principal.tenantId, graph);
  }

  async get(principal: Principal, estimateId: string, revision?: number): Promise<DamageGraph> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
    const graph = revision === undefined
      ? await this.graphs.getLatest(principal.tenantId, estimateId)
      : await this.graphs.get(principal.tenantId, estimateId, revision);
    if (!graph) throw new Error('damage_graph_not_found');
    return graph;
  }
}
