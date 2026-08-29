import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderRegistry } from './registry.js';

test('routes enabled providers by capability, asset class, region and priority', () => {
  const registry = new ProviderRegistry();
  registry.register({
    id: 'global-oem', name: 'Global OEM', capabilities: ['oem_procedures'], assetClasses: ['*'], regions: ['*'],
    licenseClass: 'licensed', priority: 20, enabled: true,
  });
  registry.register({
    id: 'us-auto', name: 'US Auto', capabilities: ['oem_procedures'], assetClasses: ['passenger_vehicle'], regions: ['US'],
    licenseClass: 'licensed', priority: 10, enabled: true,
  });
  registry.register({
    id: 'disabled', name: 'Disabled', capabilities: ['oem_procedures'], assetClasses: ['*'], regions: ['*'],
    licenseClass: 'licensed', priority: 1, enabled: false,
  });
  assert.deepEqual(registry.route('oem_procedures', 'passenger_vehicle', 'US').map((p) => p.id), ['us-auto', 'global-oem']);
});

test('free-first routing prefers public and customer-owned evidence before licensed providers', () => {
  const registry = new ProviderRegistry();
  registry.register({ id: 'paid-fast', name: 'Paid', capabilities: ['identity'], assetClasses: ['*'], regions: ['US'], licenseClass: 'licensed', priority: 1, enabled: true });
  registry.register({ id: 'owned-mid', name: 'Owned', capabilities: ['identity'], assetClasses: ['*'], regions: ['US'], licenseClass: 'owned', priority: 1, enabled: true });
  registry.register({ id: 'customer', name: 'Customer', capabilities: ['identity'], assetClasses: ['*'], regions: ['US'], licenseClass: 'customer_provided', priority: 50, enabled: true });
  registry.register({ id: 'public', name: 'Public', capabilities: ['identity'], assetClasses: ['*'], regions: ['US'], licenseClass: 'public', priority: 100, enabled: true });
  assert.deepEqual(registry.routeFreeFirst('identity', 'passenger_vehicle', 'US').map(provider => provider.id), ['public','customer','owned-mid','paid-fast']);
});

test('free-first routing still respects applicability and disabled providers', () => {
  const registry = new ProviderRegistry();
  registry.register({ id: 'public-property', name: 'Public Property', capabilities: ['valuation'], assetClasses: ['residential_property'], regions: ['US'], licenseClass: 'public', priority: 1, enabled: true });
  registry.register({ id: 'customer-auto', name: 'Customer Auto', capabilities: ['valuation'], assetClasses: ['passenger_vehicle'], regions: ['US'], licenseClass: 'customer_provided', priority: 1, enabled: true });
  registry.register({ id: 'public-disabled', name: 'Disabled Public', capabilities: ['valuation'], assetClasses: ['*'], regions: ['US'], licenseClass: 'public', priority: 0, enabled: false });
  assert.deepEqual(registry.routeFreeFirst('valuation', 'passenger_vehicle', 'US').map(provider => provider.id), ['customer-auto']);
});
