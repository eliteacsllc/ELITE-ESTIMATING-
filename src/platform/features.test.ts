import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEntitlements } from './features.js';

test('feature dependencies resolve automatically', () => {
  const result = resolveEntitlements({ enabled: ['motor_raced'], automationLevel: 'assisted' }, 'passenger_vehicle');
  assert.equal(result.enabled.has('motor_raced'), true);
  assert.equal(result.enabled.has('labor_intelligence'), true);
});

test('domain-specific features reject incompatible asset classes', () => {
  assert.throws(() => resolveEntitlements({ enabled: ['property'], automationLevel: 'manual' }, 'passenger_vehicle'), /feature_not_applicable/);
});

test('all advanced features remain optional', () => {
  const result = resolveEntitlements({ enabled: [], automationLevel: 'manual' }, 'passenger_vehicle');
  assert.equal(result.enabled.size, 0);
});
