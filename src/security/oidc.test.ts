import test from 'node:test';
import assert from 'node:assert/strict';
import { oidcConfigFromEnv } from './oidc.js';

test('OIDC remains disabled when no metadata is configured', () => {
  assert.equal(oidcConfigFromEnv({}), null);
});

test('partial OIDC configuration fails closed', () => {
  assert.throws(() => oidcConfigFromEnv({ ELITE_OIDC_ISSUER: 'https://id.example.com' }), /oidc_configuration_incomplete/);
});

test('OIDC requires HTTPS issuer and JWKS', () => {
  assert.throws(() => oidcConfigFromEnv({
    ELITE_OIDC_ISSUER: 'http://id.example.com',
    ELITE_OIDC_AUDIENCE: 'elite-estimating',
    ELITE_OIDC_JWKS_URL: 'http://id.example.com/jwks.json',
  }), /oidc_requires_https/);
});

test('valid OIDC configuration normalizes claims', () => {
  const config = oidcConfigFromEnv({
    ELITE_OIDC_ISSUER: 'https://id.example.com/',
    ELITE_OIDC_AUDIENCE: 'elite-estimating',
    ELITE_OIDC_JWKS_URL: 'https://id.example.com/.well-known/jwks.json',
  });
  assert.equal(config?.issuer, 'https://id.example.com');
  assert.equal(config?.tenantClaim, 'tenant_id');
  assert.equal(config?.rolesClaim, 'roles');
});
