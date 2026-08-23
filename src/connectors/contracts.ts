import type { AssetIdentity, EstimateLine, SourceProvenance } from '../domain/types.js';
import { ProviderCircuitBreaker, resilientCall, type ProviderHealthSnapshot } from '../providers/resilience.js';

export type ProviderCapability =
  | 'asset_identity'
  | 'build_configuration'
  | 'parts'
  | 'labor_times'
  | 'labor_rates'
  | 'materials'
  | 'market_pricing'
  | 'oem_procedures'
  | 'adas_requirements'
  | 'diagnostics'
  | 'valuation'
  | 'property_pricing'
  | 'weather_catastrophe'
  | 'codes_regulations';

export type ProviderDescriptor = {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  regions: string[];
  licenseRequired: boolean;
  tenantScopedCredentials: boolean;
};

export type DataQuery = {
  tenantId: string;
  asset: AssetIdentity;
  capability: ProviderCapability;
  jurisdiction?: string;
  asOf?: string;
  search?: string;
};

export type ProviderRecord<T = unknown> = {
  value: T;
  provenance: SourceProvenance;
};

export interface EstimatingDataProvider {
  descriptor(): ProviderDescriptor;
  supports(query: DataQuery): boolean;
  query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]>;
  health(): Promise<{ ok: boolean; latencyMs?: number; message?: string }>;
}

export type ImportEstimateResult = {
  sourceSystem: string;
  sourceEstimateId?: string;
  lines: EstimateLine[];
  warnings: string[];
};

export interface EstimateInterchangeAdapter {
  id: string;
  canImport(contentType: string, payload: Uint8Array): boolean;
  import(payload: Uint8Array): Promise<ImportEstimateResult>;
  export(lines: EstimateLine[], targetVersion?: string): Promise<Uint8Array>;
}

export class FederatedDataGateway {
  private readonly breakers = new Map<string, ProviderCircuitBreaker>();

  constructor(private readonly providers: EstimatingDataProvider[]) {
    for (const provider of providers) {
      const id = provider.descriptor().id;
      if (this.breakers.has(id)) throw new Error(`duplicate_provider_id:${id}`);
      this.breakers.set(id, new ProviderCircuitBreaker(id));
    }
  }

  async query<T>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    const eligible = this.providers.filter((provider) => provider.supports(query));
    const settled = await Promise.allSettled(eligible.map(async (provider) => {
      const descriptor = provider.descriptor();
      const breaker = this.breakers.get(descriptor.id);
      if (!breaker) throw new Error(`provider_breaker_missing:${descriptor.id}`);
      return resilientCall(breaker, () => provider.query<T>(query));
    }));
    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  healthSnapshots(): ProviderHealthSnapshot[] {
    return [...this.breakers.values()].map((breaker) => breaker.snapshot());
  }
}
