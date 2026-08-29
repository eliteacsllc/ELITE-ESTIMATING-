import assert from 'node:assert/strict';
import test from 'node:test';
import { listPublicCertificationTemplates, publicProviderProductionManifest } from './public-certification.js';

test('public certification templates require human approval but never provider secrets', () => {
  const manifest = publicProviderProductionManifest('nhtsa-vpic', { termsApproved: false, productionAuthorized: false, retentionApproved: false });
  assert.equal(manifest.credentialScope, 'none');
  assert.equal(manifest.credentialReference, '');
  assert.equal(manifest.credentialsProvisioned, false);
  assert.equal(manifest.agreementApproved, false);
  assert.equal(manifest.productionAuthorized, false);
});

test('NHTSA recall template retains authoritative safety scope', () => {
  const manifest = publicProviderProductionManifest('nhtsa-recalls', { termsApproved: true, productionAuthorized: true, retentionApproved: true });
  assert.deepEqual(manifest.capabilities, ['safety_recalls']);
  assert.deepEqual(manifest.safetyAuthoritativeCapabilities, ['safety_recalls']);
  assert.ok(manifest.assetClasses.includes('passenger_vehicle'));
});

test('OpenFEMA template scopes catastrophe data to property', () => {
  const manifest = publicProviderProductionManifest('openfema-disasters', { termsApproved: true, productionAuthorized: true, retentionApproved: true });
  assert.deepEqual(manifest.capabilities, ['weather_catastrophe']);
  assert.deepEqual(manifest.assetClasses, ['residential_property','commercial_property']);
});

test('NWS template enables free catastrophe context across property and supported road assets', () => {
  const manifest = publicProviderProductionManifest('nws-alerts', { termsApproved: true, productionAuthorized: true, retentionApproved: true });
  assert.deepEqual(manifest.capabilities, ['weather_catastrophe']);
  assert.ok(manifest.assetClasses.includes('residential_property'));
  assert.ok(manifest.assetClasses.includes('passenger_vehicle'));
  assert.equal(manifest.credentialScope, 'none');
});

test('public template inventory remains explicit', () => {
  assert.deepEqual(listPublicCertificationTemplates(), ['nhtsa-recalls','nhtsa-vpic','nws-alerts','openfema-disasters']);
});
