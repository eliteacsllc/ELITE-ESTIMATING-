import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEntitlements } from './features.js';

test('feature dependencies resolve automatically', () => {
  const result = resolveEntitlements({ enabled: ['motor_raced'], automationLevel: 'assisted' }, 'passenger_vehicle');
  assert.equal(result.enabled.has('motor_raced'), true);
  assert.equal(result.enabled.has('labor_intelligence'), true);
});

test('top ranked repair intelligence stack resolves required foundations', () => {
  const result = resolveEntitlements({ enabled: ['damage_ai','parts_exchange','supplement_prediction','universal_dispatch'], automationLevel: 'copilot' }, 'passenger_vehicle');
  for (const feature of ['repair_intelligence','estimate_audit','parts_optimizer','supplements','universal_interchange'] as const) {
    assert.equal(result.enabled.has(feature), true, `expected dependency ${feature}`);
  }
});

test('domain-specific features reject incompatible asset classes', () => {
  assert.throws(() => resolveEntitlements({ enabled: ['property'], automationLevel: 'manual' }, 'passenger_vehicle'), /feature_not_applicable/);
});

test('all advanced features remain optional', () => {
  const result = resolveEntitlements({ enabled: [], automationLevel: 'manual' }, 'passenger_vehicle');
  assert.equal(result.enabled.size, 0);
});
