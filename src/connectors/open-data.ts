import type { AssetIdentity, SourceProvenance } from '../domain/types.js';
import type { DataQuery, EstimatingDataProvider, ProviderCapability, ProviderDescriptor, ProviderRecord } from './contracts.js';

export type HttpFetcher = (input: string, init?: RequestInit) => Promise<Response>;

function publicProvenance(provider: string, sourceId?: string, confidence = 0.95): SourceProvenance {
  return {
    provider,
    sourceId,
    retrievedAt: new Date().toISOString(),
    region: 'US',
    licenseClass: 'public',
    confidence,
  };
}

function vehicleAsset(asset: AssetIdentity): boolean {
  return ['passenger_vehicle','commercial_vehicle','tractor_trailer','motorcycle','rv','ambulance_emergency'].includes(asset.assetClass);
}

export class NhtsaVpicProvider implements EstimatingDataProvider {
  constructor(private readonly fetcher: HttpFetcher = fetch) {}

  descriptor(): ProviderDescriptor {
    return {
      id: 'nhtsa-vpic',
      name: 'NHTSA vPIC',
      capabilities: ['asset_identity','build_configuration'],
      regions: ['US'],
      licenseRequired: false,
      tenantScopedCredentials: false,
    };
  }

  supports(query: DataQuery): boolean {
    return vehicleAsset(query.asset)
      && ['asset_identity','build_configuration'].includes(query.capability)
      && typeof query.asset.vin === 'string'
      && query.asset.vin.trim().length === 17;
  }

  async query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    if (!this.supports(query)) return [];
    const vin = encodeURIComponent(query.asset.vin!.trim().toUpperCase());
    const year = query.asset.year ? `&modelyear=${encodeURIComponent(String(query.asset.year))}` : '';
    const response = await this.fetcher(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json${year}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`nhtsa_vpic_http_${response.status}`);
    const payload = await response.json() as { Results?: Array<Record<string, unknown>> };
    const first = payload.Results?.[0];
    if (!first) return [];
    return [{ value: first as T, provenance: publicProvenance('nhtsa-vpic', query.asset.vin, 0.98) }];
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    const started = Date.now();
    try {
      const response = await this.fetcher('https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json', { headers: { accept: 'application/json' } });
      return { ok: response.ok, latencyMs: Date.now() - started, message: response.ok ? undefined : `http_${response.status}` };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class NhtsaRecallsProvider implements EstimatingDataProvider {
  constructor(private readonly fetcher: HttpFetcher = fetch) {}

  descriptor(): ProviderDescriptor {
    return {
      id: 'nhtsa-recalls',
      name: 'NHTSA Recalls',
      capabilities: ['safety_recalls'],
      regions: ['US'],
      licenseRequired: false,
      tenantScopedCredentials: false,
    };
  }

  supports(query: DataQuery): boolean {
    return vehicleAsset(query.asset)
      && query.capability === 'safety_recalls'
      && Number.isInteger(query.asset.year)
      && Boolean(query.asset.make?.trim())
      && Boolean(query.asset.model?.trim());
  }

  async query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    if (!this.supports(query)) return [];
    const make = encodeURIComponent(query.asset.make!.trim());
    const model = encodeURIComponent(query.asset.model!.trim());
    const year = encodeURIComponent(String(query.asset.year));
    const response = await this.fetcher(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${make}&model=${model}&modelYear=${year}`, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`nhtsa_recalls_http_${response.status}`);
    const payload = await response.json() as { results?: unknown[]; Results?: unknown[] };
    const records = payload.results ?? payload.Results ?? [];
    return records.map((value, index) => ({
      value: value as T,
      provenance: publicProvenance('nhtsa-recalls', `${query.asset.year}:${query.asset.make}:${query.asset.model}:${index}`, 0.99),
    }));
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    const started = Date.now();
    try {
      const response = await this.fetcher('https://api.nhtsa.gov/products/vehicle/modelYears?issueType=r', { headers: { accept: 'application/json' } });
      return { ok: response.ok, latencyMs: Date.now() - started, message: response.ok ? undefined : `http_${response.status}` };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) };
    }
  }
}

export type CustomerEvidenceRecord<T = unknown> = {
  capability: ProviderCapability;
  value: T;
  sourceId: string;
  region?: string;
  confidence?: number;
};

export type CustomerEvidenceLoader = (query: DataQuery) => Promise<CustomerEvidenceRecord[]>;

export class CustomerEvidenceProvider implements EstimatingDataProvider {
  private readonly capabilitySet: Set<ProviderCapability>;

  constructor(capabilities: ProviderCapability[], private readonly loader: CustomerEvidenceLoader) {
    this.capabilitySet = new Set(capabilities);
  }

  descriptor(): ProviderDescriptor {
    return {
      id: 'customer-evidence',
      name: 'Customer-owned evidence',
      capabilities: [...this.capabilitySet],
      regions: ['*'],
      licenseRequired: false,
      tenantScopedCredentials: false,
    };
  }

  supports(query: DataQuery): boolean {
    return this.capabilitySet.has(query.capability);
  }

  async query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    if (!this.supports(query)) return [];
    const records = await this.loader(query);
    return records
      .filter(record => record.capability === query.capability)
      .map(record => ({
        value: record.value as T,
        provenance: {
          provider: 'customer-evidence',
          sourceId: record.sourceId,
          retrievedAt: new Date().toISOString(),
          region: record.region ?? query.jurisdiction ?? query.asset.jurisdiction,
          licenseClass: 'customer_provided' as const,
          confidence: record.confidence,
        },
      }));
  }

  async health(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'customer_evidence_loader_ready' };
  }
}

export const FREE_FIRST_PROVIDER_DESCRIPTORS: ProviderDescriptor[] = [
  new NhtsaVpicProvider(async () => new Response(null, { status: 204 })).descriptor(),
  new NhtsaRecallsProvider(async () => new Response(null, { status: 204 })).descriptor(),
];
