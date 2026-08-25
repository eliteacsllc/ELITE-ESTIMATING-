import type { DataQuery, EstimatingDataProvider, ProviderDescriptor, ProviderRecord } from './contracts.js';

export type ProviderAdapterImplementation = {
  supports(query: DataQuery): boolean;
  query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]>;
  health(): Promise<{ ok: boolean; latencyMs?: number; message?: string }>;
};

export class GovernedProviderAdapter implements EstimatingDataProvider {
  constructor(
    private readonly definition: ProviderDescriptor,
    private readonly implementation: ProviderAdapterImplementation,
  ) {
    if (!definition.id.trim()) throw new Error('provider_id_required');
  }

  descriptor(): ProviderDescriptor { return structuredClone(this.definition); }

  supports(query: DataQuery): boolean {
    if (!query.tenantId.trim()) return false;
    if (!this.definition.capabilities.includes(query.capability)) return false;
    if (query.jurisdiction && !this.definition.regions.includes('*') && !this.definition.regions.some(region => region.toUpperCase() === query.jurisdiction!.toUpperCase())) return false;
    return this.implementation.supports(query);
  }

  async query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    if (!query.tenantId.trim()) throw new Error('provider_tenant_required');
    if (!this.supports(query)) throw new Error(`provider_query_not_supported:${this.definition.id}:${query.capability}`);
    const records = await this.implementation.query<T>(query);
    return records.map((record, index) => {
      if (!record.provenance?.provider?.trim()) throw new Error(`provider_provenance_required:${this.definition.id}:${index}`);
      return record;
    });
  }

  health(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    return this.implementation.health();
  }
}
