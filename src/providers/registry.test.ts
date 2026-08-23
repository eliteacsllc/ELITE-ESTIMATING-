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
