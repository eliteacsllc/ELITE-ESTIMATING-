import type { AssetIdentity, EstimateLine, SourceProvenance } from '../domain/types.js';

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
  constructor(private readonly providers: EstimatingDataProvider[]) {}

  async query<T>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    const eligible = this.providers.filter((provider) => provider.supports(query));
    const settled = await Promise.allSettled(eligible.map((provider) => provider.query<T>(query)));
    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }
}
