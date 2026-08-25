import type { AssetClass } from '../domain/types.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import { FEATURE_REGISTRY, resolveEntitlements, type AutomationLevel, type FeatureId } from './features.js';
import type { TenantFeatureProfile, TenantFeatureProfileRepository } from './entitlement-repository.js';

export type SetTenantFeatureProfileInput = {
  assetClass: AssetClass;
  enabledFeatures: FeatureId[];
  automationLevel: AutomationLevel;
};

const ASSET_CLASSES = new Set<AssetClass>([
  'passenger_vehicle','commercial_vehicle','tractor_trailer','heavy_equipment','motorcycle','atv_utv','rv','marine',
  'ambulance_emergency','crane_specialty','residential_property','commercial_property','contents','other',
]);
const AUTOMATION_LEVELS = new Set<AutomationLevel>(['manual','assisted','copilot','automated_draft','governed_autonomy']);

function assertAssetClass(value: unknown): asserts value is AssetClass {
  if (typeof value !== 'string' || !ASSET_CLASSES.has(value as AssetClass)) throw new Error('invalid_asset_class');
}

function assertFeatureIds(value: unknown): asserts value is FeatureId[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item in FEATURE_REGISTRY)) throw new Error('invalid_enabled_features');
}

function assertAutomationLevel(value: unknown): asserts value is AutomationLevel {
  if (typeof value !== 'string' || !AUTOMATION_LEVELS.has(value as AutomationLevel)) throw new Error('invalid_automation_level');
}

export class TenantEntitlementService {
  constructor(private readonly repository: TenantFeatureProfileRepository) {}

  async get(principal: Principal, assetClass: AssetClass): Promise<TenantFeatureProfile> {
    authorize(principal, 'estimate:read', principal.tenantId);
    assertAssetClass(assetClass);
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
    assertAssetClass(input.assetClass);
    assertFeatureIds(input.enabledFeatures);
    assertAutomationLevel(input.automationLevel);
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
