import type { SourceProvenance } from '../domain/types.js';
import type { DataQuery, EstimatingDataProvider, ProviderDescriptor, ProviderRecord } from './contracts.js';
import type { HttpFetcher } from './open-data.js';

const DEFAULT_USER_AGENT = 'EliteEstimating/0.5.8';

function stateFromQuery(query: DataQuery): string | null {
  const candidates = [query.search, query.jurisdiction, query.asset.jurisdiction]
    .filter(Boolean)
    .map(value => String(value).trim().toUpperCase());
  for (const value of candidates) {
    if (/^[A-Z]{2}$/.test(value)) return value;
    const match = value.match(/(?:^|[-_:])([A-Z]{2})$/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function supportedAsset(query: DataQuery): boolean {
  return ['residential_property','commercial_property','passenger_vehicle','commercial_vehicle','tractor_trailer','rv','ambulance_emergency'].includes(query.asset.assetClass);
}

function provenance(sourceId: string, state: string): SourceProvenance {
  return {
    provider: 'nws-alerts',
    sourceId,
    retrievedAt: new Date().toISOString(),
    region: `US-${state}`,
    licenseClass: 'public',
    confidence: 0.99,
  };
}

export class NwsAlertsProvider implements EstimatingDataProvider {
  constructor(
    private readonly fetcher: HttpFetcher = fetch,
    private readonly userAgent = DEFAULT_USER_AGENT,
  ) {}

  descriptor(): ProviderDescriptor {
    return {
      id: 'nws-alerts',
      name: 'National Weather Service Alerts',
      capabilities: ['weather_catastrophe'],
      regions: ['US'],
      licenseRequired: false,
      tenantScopedCredentials: false,
      credentialMode: 'none',
    };
  }

  supports(query: DataQuery): boolean {
    return query.capability === 'weather_catastrophe' && supportedAsset(query) && stateFromQuery(query) !== null;
  }

  async query<T = unknown>(query: DataQuery): Promise<ProviderRecord<T>[]> {
    if (!this.supports(query)) return [];
    const state = stateFromQuery(query)!;
    const response = await this.fetcher(`https://api.weather.gov/alerts/active?area=${encodeURIComponent(state)}`, {
      headers: { accept: 'application/geo+json', 'user-agent': this.userAgent },
    });
    if (!response.ok) throw new Error(`nws_alerts_http_${response.status}`);
    const payload = await response.json() as { features?: Array<{ id?: string; properties?: Record<string, unknown> }> };
    return (payload.features ?? []).map((feature, index) => ({
      value: feature as T,
      provenance: provenance(feature.id ?? String(feature.properties?.id ?? index), state),
    }));
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    const started = Date.now();
    try {
      const response = await this.fetcher('https://api.weather.gov/alerts/active?status=actual&limit=1', {
        headers: { accept: 'application/geo+json', 'user-agent': this.userAgent },
      });
      const latencyMs = Date.now() - started;
      if (response.ok) return { ok: true, latencyMs };
      return { ok: false, latencyMs, message: `http_${response.status}` };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) };
    }
  }
}

export const NWS_ALERTS_DESCRIPTOR = new NwsAlertsProvider(async () => new Response(null, { status: 204 })).descriptor();
