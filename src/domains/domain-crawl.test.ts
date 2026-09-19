import test from 'node:test';
import assert from 'node:assert/strict';
import type { AssetIdentity } from '../domain/types.js';
import { validateAssetIdentity } from '../domain/validation.js';
import { domainForAsset } from './registry.js';

const representatives: AssetIdentity[] = [
  { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352' },
  { assetClass: 'commercial_vehicle', vin: '1HTMMMML1KH123456' },
  { assetClass: 'tractor_trailer', vin: '1FUJGLDR9CLBC1234' },
  { assetClass: 'heavy_equipment', serialNumber: 'HEX-100', operatingHours: 4300 },
  { assetClass: 'agricultural_equipment', serialNumber: 'AG-100', operatingHours: 2100 },
  { assetClass: 'material_handling_equipment', serialNumber: 'MH-100', operatingHours: 8500 },
  { assetClass: 'industrial_machinery', serialNumber: 'CNC-100', operatingHours: 12500 },
  { assetClass: 'motorcycle', vin: 'JH2RC44653M000001' },
  { assetClass: 'atv_utv', serialNumber: 'UTV-100' },
  { assetClass: 'rv', vin: '1FDXE45S12HA00001' },
  { assetClass: 'marine', hin: 'ABC12345D626' },
  { assetClass: 'ambulance_emergency', vin: '1FDXE4FS0HDC00001' },
  { assetClass: 'crane_specialty', serialNumber: 'CRN-100', operatingHours: 5000 },
  { assetClass: 'residential_property' },
  { assetClass: 'commercial_property' },
  { assetClass: 'contents' },
  { assetClass: 'other', serialNumber: 'SPECIAL-100' },
];

test('domain crawl: every canonical asset validates and resolves to an operational plan', () => {
  for (const asset of representatives) {
    assert.deepEqual(validateAssetIdentity(asset), [], `identity failed for ${asset.assetClass}`);
    const plan = domainForAsset(asset).plan(asset);
    assert.equal(plan.assetClass, asset.assetClass);
    assert.ok(plan.allowedOperations.length > 0, `missing operations for ${asset.assetClass}`);
    assert.ok(plan.providerCapabilities.length > 0, `missing provider capabilities for ${asset.assetClass}`);
    assert.ok(plan.checklist.length > 0, `missing checklist for ${asset.assetClass}`);
  }
});

test('domain crawl: high-complexity specialty assets cannot collapse into generic specialty', () => {
  for (const assetClass of ['heavy_equipment','agricultural_equipment','material_handling_equipment','industrial_machinery','rv','marine'] as const) {
    const asset: AssetIdentity = { assetClass };
    const plan = domainForAsset(asset).plan(asset);
    assert.notEqual(plan.domain, 'specialty');
    assert.ok(plan.profileSections.length > 0, `missing profile for ${assetClass}`);
    assert.ok(plan.riskFlags.length > 0, `missing risk controls for ${assetClass}`);
  }
});
