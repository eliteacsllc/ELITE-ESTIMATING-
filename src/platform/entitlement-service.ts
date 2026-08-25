import type { AssetClass } from '../domain/types.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import { resolveEntitlements, type AutomationLevel, type FeatureId } from './features.js';
import type { TenantFeatureProfile, TenantFeatureProfileRepository } from './entitlement-repository.js';

export type SetTenantFeatureProfileInput = {
  assetClass: AssetClass;
  enabledFeatures: FeatureId[];
  automationLevel: AutomationLevel;
};

export class TenantEntitlementService {
  constructor(private readonly repository: TenantFeatureProfileRepository) {}

  async get(principal: Principal, assetClass: AssetClass): Promise<TenantFeatureProfile> {
    authorize(principal, 'estimate:read', principal.tenantId);
    const existing = await this.repository.get(principal.tenantId, assetClass);
    if (existing) return existing;
    const now = new Date().toISOString();
    return { tenantId: principal.tenantId, assetClass, enabledFeatures: [], automationLevel: 'manual', updatedBy: 'system-default', createdAt: now, updatedAt: now };
  }

  async list(principal: Principal): Promise<TenantFeatureProfile[]> {
    authorize(principal, 'estimate:read', principal.tenantId);
    return this.repository.list(principal.tenantId);
  }

  async set(principal: Principal, input: SetTenantFeatureProfileInput): Promise<TenantFeatureProfile> {
    authorize(principal, 'features:configure', principal.tenantId);
    const unique = [...new Set(input.enabledFeatures)];
    const resolved = resolveEntitlements({ enabled: unique, automationLevel: input.automationLevel }, input.assetClass);
    const now = new Date().toISOString();
    const existing = await this.repository.get(principal.tenantId, input.assetClass);
    const profile: TenantFeatureProfile = {
      tenantId: principal.tenantId,
      assetClass: input.assetClass,
      enabledFeatures: [...resolved.enabled].sort(),
      automationLevel: resolved.automationLevel,
      updatedBy: principal.userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return this.repository.save(profile);
  }
}
