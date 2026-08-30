import assert from 'node:assert/strict';
import test from 'node:test';
import { authorize, type Principal } from './rbac.js';

const estimator: Principal = { userId: 'user-a', tenantId: 'tenant-a', roles: ['estimator'] };
const reviewer: Principal = { userId: 'user-r', tenantId: 'tenant-a', roles: ['reviewer'] };
const readOnly: Principal = { userId: 'user-ro', tenantId: 'tenant-a', roles: ['read_only'] };
const platformAdmin: Principal = { userId: 'platform-admin', tenantId: 'platform', roles: ['platform_admin'] };

test('same-tenant estimator can perform granted actions', () => {
  assert.doesNotThrow(() => authorize(estimator, 'estimate:create', 'tenant-a'));
  assert.doesNotThrow(() => authorize(estimator, 'evidence:read', 'tenant-a'));
});

test('cross-tenant access is denied before action grants are considered', () => {
  assert.throws(() => authorize(estimator, 'estimate:read', 'tenant-b'), /cross_tenant_access_denied/);
  assert.throws(() => authorize(reviewer, 'estimate:approve', 'tenant-b'), /cross_tenant_access_denied/);
});

test('same-tenant principal is still denied actions outside its role', () => {
  assert.throws(() => authorize(readOnly, 'estimate:update', 'tenant-a'), /action_not_permitted/);
  assert.throws(() => authorize(estimator, 'provider:configure', 'tenant-a'), /action_not_permitted/);
});

test('platform admin may cross tenant boundary for explicitly granted administrative operations', () => {
  assert.doesNotThrow(() => authorize(platformAdmin, 'estimate:read', 'tenant-b'));
  assert.doesNotThrow(() => authorize(platformAdmin, 'provider:configure', 'tenant-b'));
});

test('empty-role principal cannot exploit same-tenant access', () => {
  const unprivileged: Principal = { userId: 'nobody', tenantId: 'tenant-a', roles: [] };
  assert.throws(() => authorize(unprivileged, 'estimate:read', 'tenant-a'), /action_not_permitted/);
});
