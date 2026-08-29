import type { AssetClass, SourceProvenance } from '../domain/types.js';

export type RoutingCapability =
  | 'identity'
  | 'parts'
  | 'labor'
  | 'materials'
  | 'property_pricing'
  | 'oem_procedures'
  | 'adas'
  | 'diagnostics'
  | 'valuation'
  | 'interchange';

export type RoutingProviderDescriptor = {
  id: string;
  name: string;
  capabilities: RoutingCapability[];
  assetClasses: AssetClass[] | ['*'];
  regions: string[] | ['*'];
  licenseClass: SourceProvenance['licenseClass'];
  priority: number;
  enabled: boolean;
};

const FREE_FIRST_RANK: Record<SourceProvenance['licenseClass'], number> = {
  public: 0,
  customer_provided: 1,
  owned: 2,
  licensed: 3,
};

export class ProviderRegistry {
  private readonly providers = new Map<string, RoutingProviderDescriptor>();

  register(provider: RoutingProviderDescriptor): void {
    if (this.providers.has(provider.id)) throw new Error('provider_already_registered');
    this.providers.set(provider.id, Object.freeze({ ...provider }));
  }

  private eligible(capability: RoutingCapability, assetClass: AssetClass, region: string): RoutingProviderDescriptor[] {
    return [...this.providers.values()]
      .filter((provider) => provider.enabled)
      .filter((provider) => provider.capabilities.includes(capability))
      .filter((provider) => provider.assetClasses[0] === '*' || (provider.assetClasses as AssetClass[]).includes(assetClass))
      .filter((provider) => provider.regions[0] === '*' || (provider.regions as string[]).includes(region));
  }

  route(capability: RoutingCapability, assetClass: AssetClass, region: string): RoutingProviderDescriptor[] {
    return this.eligible(capability, assetClass, region).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  routeFreeFirst(capability: RoutingCapability, assetClass: AssetClass, region: string): RoutingProviderDescriptor[] {
    return this.eligible(capability, assetClass, region).sort((a, b) =>
      FREE_FIRST_RANK[a.licenseClass] - FREE_FIRST_RANK[b.licenseClass]
      || a.priority - b.priority
      || a.id.localeCompare(b.id));
  }

  list(): RoutingProviderDescriptor[] {
    return [...this.providers.values()];
  }
}
