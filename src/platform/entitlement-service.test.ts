import assert from 'node:assert/strict';
import test from 'node:test';
import type { Principal } from '../security/rbac.js';
import { InMemoryTenantFeatureProfileRepository } from './entitlement-repository.js';
import { TenantEntitlementService } from './entitlement-service.js';

const tenantAdmin: Principal = { userId: 'admin-a', tenantId: 'tenant-a', roles: ['tenant_admin'] };
const estimator: Principal = { userId: 'estimator-a', tenantId: 'tenant-a', roles: ['estimator'] };
const otherAdmin: Principal = { userId: 'admin-b', tenantId: 'tenant-b', roles: ['tenant_admin'] };

test('missing profile defaults to manual with no premium features', async () => {
  const service = new TenantEntitlementService(new InMemoryTenantFeatureProfileRepository());
  const profile = await service.get(estimator, 'passenger_vehicle');
  assert.equal(profile.tenantId, 'tenant-a');
  assert.equal(profile.automationLevel, 'manual');
  assert.deepEqual(profile.enabledFeatures, []);
  assert.equal(profile.updatedBy, 'system-default');
});

test('tenant admin can persist optional features and dependency expansion', async () => {
  const repository = new InMemoryTenantFeatureProfileRepository();
  const service = new TenantEntitlementService(repository);
  const saved = await service.set(tenantAdmin, {
    assetClass: 'passenger_vehicle',
    enabledFeatures: ['motor_raced', 'adas_diagnostics'],
    automationLevel: 'copilot',
  });
  assert.equal(saved.automationLevel, 'copilot');
  assert.ok(saved.enabledFeatures.includes('motor_raced'));
  assert.ok(saved.enabledFeatures.includes('labor_intelligence'));
  assert.ok(saved.enabledFeatures.includes('adas_diagnostics'));
  assert.ok(saved.enabledFeatures.includes('oem_procedures'));
  const reread = await service.get(estimator, 'passenger_vehicle');
  assert.deepEqual(reread.enabledFeatures, saved.enabledFeatures);
});

test('non-admin estimator cannot change tenant feature configuration', async () => {
  const service = new TenantEntitlementService(new InMemoryTenantFeatureProfileRepository());
  await assert.rejects(() => service.set(estimator, {
    assetClass: 'passenger_vehicle', enabledFeatures: ['super_appraiser'], automationLevel: 'assisted',
  }), /action_not_permitted/);
});

test('profiles are isolated by tenant and asset class', async () => {
  const repository = new InMemoryTenantFeatureProfileRepository();
  const service = new TenantEntitlementService(repository);
  await service.set(tenantAdmin, { assetClass: 'passenger_vehicle', enabledFeatures: ['collision'], automationLevel: 'assisted' });
  await service.set(otherAdmin, { assetClass: 'residential_property', enabledFeatures: ['property'], automationLevel: 'manual' });
  assert.equal((await service.list(tenantAdmin)).length, 1);
  assert.equal((await service.list(otherAdmin)).length, 1);
  assert.equal((await service.get(otherAdmin, 'passenger_vehicle')).automationLevel, 'manual');
});

test('inapplicable features are rejected for the selected asset class', async () => {
  const service = new TenantEntitlementService(new InMemoryTenantFeatureProfileRepository());
  await assert.rejects(() => service.set(tenantAdmin, {
    assetClass: 'residential_property', enabledFeatures: ['motor_raced'], automationLevel: 'manual',
  }), /feature_not_applicable:motor_raced:residential_property/);
});

test('runtime-invalid feature and automation values are rejected', async () => {
  const service = new TenantEntitlementService(new InMemoryTenantFeatureProfileRepository());
  await assert.rejects(() => service.set(tenantAdmin, {
    assetClass: 'passenger_vehicle', enabledFeatures: ['not-real' as never], automationLevel: 'manual',
  }), /invalid_enabled_features/);
  await assert.rejects(() => service.set(tenantAdmin, {
    assetClass: 'passenger_vehicle', enabledFeatures: [], automationLevel: 'unbounded' as never,
  }), /invalid_automation_level/);
  await assert.rejects(() => service.get(tenantAdmin, 'spaceship' as never), /invalid_asset_class/);
});
