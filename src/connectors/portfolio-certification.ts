import type { AssetClass } from '../domain/types.js';
import type { ProviderCapability } from './contracts.js';
import type { ProviderProductionCertification } from './production-certification.js';

export type ProviderPortfolioRequirement = {
  assetClass: AssetClass;
  region: string;
  capabilities: ProviderCapability[];
};

export type ProviderPortfolioCertification = {
  green: boolean;
  coverage: Record<ProviderCapability, string[]>;
  gaps: Array<{ assetClass: AssetClass; region: string; capability: ProviderCapability }>;
};

export function certifyProviderPortfolio(
  requirements: ProviderPortfolioRequirement[],
  certifications: ProviderProductionCertification[],
): ProviderPortfolioCertification {
  const coverage = {} as Record<ProviderCapability, string[]>;
  const gaps: ProviderPortfolioCertification['gaps'] = [];

  for (const requirement of requirements) {
    for (const capability of requirement.capabilities) {
      const providers = certifications
        .filter(cert => cert.green)
        .filter(cert => cert.manifest.capabilities.includes(capability))
        .filter(cert => cert.manifest.assetClasses.includes(requirement.assetClass))
        .filter(cert => cert.manifest.regions.some(region => region === '*' || region.toUpperCase() === requirement.region.toUpperCase()))
        .map(cert => cert.providerId);
      coverage[capability] = [...new Set([...(coverage[capability] ?? []), ...providers])];
      if (providers.length === 0) gaps.push({ assetClass: requirement.assetClass, region: requirement.region, capability });
    }
  }

  return { green: gaps.length === 0, coverage, gaps };
}
