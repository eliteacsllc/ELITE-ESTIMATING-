import assert from 'node:assert/strict';
import test from 'node:test';
import { NwsAlertsProvider } from './nws-weather.js';

test('NWS alerts uses the official no-key API with an application user agent', async () => {
  let receivedHeaders: HeadersInit | undefined;
  const provider = new NwsAlertsProvider(async (url, init) => {
    assert.match(url, /api\.weather\.gov\/alerts\/active\?area=DE/);
    receivedHeaders = init?.headers;
    return new Response(JSON.stringify({ features: [{ id: 'urn:oid:test-alert', properties: { event: 'Severe Thunderstorm Warning' } }] }), { status: 200 });
  }, 'EliteEstimating-Test/1.0');
  const query = { tenantId: 't1', asset: { assetClass: 'residential_property' as const, jurisdiction: 'US-DE' }, capability: 'weather_catastrophe' as const, jurisdiction: 'US-DE' };
  assert.equal(provider.supports(query), true);
  const records = await provider.query(query);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.provenance.provider, 'nws-alerts');
  assert.equal(records[0]!.provenance.licenseClass, 'public');
  assert.equal(records[0]!.provenance.region, 'US-DE');
  assert.deepEqual(receivedHeaders, { accept: 'application/geo+json', 'user-agent': 'EliteEstimating-Test/1.0' });
});

test('NWS alerts requires supported US state scope', () => {
  const provider = new NwsAlertsProvider(async () => new Response('{}', { status: 200 }));
  assert.equal(provider.supports({ tenantId: 't1', asset: { assetClass: 'residential_property' }, capability: 'weather_catastrophe' }), false);
  assert.equal(provider.supports({ tenantId: 't1', asset: { assetClass: 'marine', jurisdiction: 'US-DE' }, capability: 'weather_catastrophe' }), false);
});
