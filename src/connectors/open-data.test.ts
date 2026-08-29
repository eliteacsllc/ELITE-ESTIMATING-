import assert from 'node:assert/strict';
import test from 'node:test';
import { CustomerEvidenceProvider, NhtsaRecallsProvider, NhtsaVpicProvider, OpenFemaDisasterProvider } from './open-data.js';

const vehicle = { assetClass: 'passenger_vehicle' as const, vin: '1HGBH41JXMN109186', year: 2020, make: 'Honda', model: 'Accord', jurisdiction: 'US' };

test('NHTSA vPIC supplies public VIN/build provenance without credentials', async () => {
  const provider = new NhtsaVpicProvider(async url => {
    assert.match(url, /vpic\.nhtsa\.dot\.gov\/api\/vehicles\/DecodeVinValuesExtended/);
    return new Response(JSON.stringify({ Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2020' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const descriptor = provider.descriptor();
  assert.equal(descriptor.licenseRequired, false);
  assert.equal(descriptor.tenantScopedCredentials, false);
  assert.deepEqual(descriptor.capabilities, ['asset_identity','build_configuration']);
  const records = await provider.query({ tenantId: 't1', asset: vehicle, capability: 'asset_identity' });
  assert.equal(records.length, 1);
  assert.equal(records[0]!.provenance.provider, 'nhtsa-vpic');
  assert.equal(records[0]!.provenance.licenseClass, 'public');
});

test('NHTSA recalls supplies public safety records for identified road vehicles', async () => {
  const provider = new NhtsaRecallsProvider(async url => {
    assert.match(url, /api\.nhtsa\.gov\/recalls\/recallsByVehicle/);
    return new Response(JSON.stringify({ results: [{ NHTSACampaignNumber: '20V000000', Component: 'AIR BAGS' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  assert.equal(provider.supports({ tenantId: 't1', asset: vehicle, capability: 'safety_recalls' }), true);
  const records = await provider.query({ tenantId: 't1', asset: vehicle, capability: 'safety_recalls' });
  assert.equal(records.length, 1);
  assert.equal(records[0]!.provenance.provider, 'nhtsa-recalls');
  assert.equal(records[0]!.provenance.licenseClass, 'public');
});

test('OpenFEMA supplies free property catastrophe context without registration', async () => {
  const provider = new OpenFemaDisasterProvider(async url => {
    assert.match(url, /fema\.gov\/api\/open\/v1\/DisasterDeclarationsSummaries/);
    assert.match(decodeURIComponent(url), /state eq 'DE'/);
    return new Response(JSON.stringify({ DisasterDeclarationsSummaries: [{ disasterNumber: 4999, state: 'DE', incidentType: 'Severe Storm' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const asset = { assetClass: 'residential_property' as const, jurisdiction: 'US-DE' };
  assert.equal(provider.supports({ tenantId: 't1', asset, jurisdiction: 'US-DE', capability: 'weather_catastrophe' }), true);
  const records = await provider.query({ tenantId: 't1', asset, jurisdiction: 'US-DE', capability: 'weather_catastrophe' });
  assert.equal(records.length, 1);
  assert.equal(records[0]!.provenance.provider, 'openfema-disasters');
  assert.equal(records[0]!.provenance.region, 'US-DE');
  assert.equal(records[0]!.provenance.licenseClass, 'public');
});

test('customer evidence can satisfy paid-style capability contracts without a paid platform dependency', async () => {
  const provider = new CustomerEvidenceProvider(['labor_times','oem_procedures','parts','market_pricing'], async query => [
    { capability: query.capability, value: { note: 'uploaded authorized evidence' }, sourceId: 'upload-123', region: 'US', confidence: 0.9 },
  ]);
  const descriptor = provider.descriptor();
  assert.equal(descriptor.licenseRequired, false);
  assert.ok(descriptor.capabilities.includes('labor_times'));
  const records = await provider.query({ tenantId: 't1', asset: vehicle, capability: 'oem_procedures' });
  assert.equal(records.length, 1);
  assert.equal(records[0]!.provenance.licenseClass, 'customer_provided');
  assert.equal(records[0]!.provenance.sourceId, 'upload-123');
});

test('public providers fail closed outside their supported asset or identity scope', () => {
  const vpic = new NhtsaVpicProvider(async () => new Response('{}', { status: 200 }));
  const recalls = new NhtsaRecallsProvider(async () => new Response('{}', { status: 200 }));
  const fema = new OpenFemaDisasterProvider(async () => new Response('{}', { status: 200 }));
  assert.equal(vpic.supports({ tenantId: 't1', asset: { assetClass: 'residential_property' }, capability: 'asset_identity' }), false);
  assert.equal(recalls.supports({ tenantId: 't1', asset: { assetClass: 'passenger_vehicle', make: 'Honda' }, capability: 'safety_recalls' }), false);
  assert.equal(fema.supports({ tenantId: 't1', asset: { assetClass: 'residential_property' }, capability: 'weather_catastrophe' }), false);
});
