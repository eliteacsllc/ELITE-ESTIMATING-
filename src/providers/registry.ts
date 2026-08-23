import type { AssetClass, SourceProvenance } from '../domain/types.js';

export type ProviderCapability =
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

export type ProviderDescriptor = {
  id: string;
  name: string;
  capabilities: ProviderCapability[];
  assetClasses: AssetClass[] | ['*'];
  regions: string[] | ['*'];
  licenseClass: SourceProvenance['licenseClass'];
  priority: number;
  enabled: boolean;
};

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderDescriptor>();

  register(provider: ProviderDescriptor): void {
    if (this.providers.has(provider.id)) throw new Error('provider_already_registered');
    this.providers.set(provider.id, Object.freeze({ ...provider }));
  }

  route(capability: ProviderCapability, assetClass: AssetClass, region: string): ProviderDescriptor[] {
    return [...this.providers.values()]
      .filter((provider) => provider.enabled)
      .filter((provider) => provider.capabilities.includes(capability))
      .filter((provider) => provider.assetClasses[0] === '*' || (provider.assetClasses as AssetClass[]).includes(assetClass))
      .filter((provider) => provider.regions[0] === '*' || provider.regions.includes(region))
      .sort((a, b) => a.priority - b.priority);
  }

  list(): ProviderDescriptor[] {
    return [...this.providers.values()];
  }
}
