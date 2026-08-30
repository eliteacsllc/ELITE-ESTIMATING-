import assert from 'node:assert/strict';
import test from 'node:test';
import { GLOBAL_ESTIMATING_SOURCES, planSourceActivation, sourcesForCapability } from './global-source-catalog.js';

function source(id: string) {
  const value = GLOBAL_ESTIMATING_SOURCES.find(item => item.id === id);
  if (!value) throw new Error(`missing_source:${id}`);
  return value;
}

test('licensed source is blocked without provider agreement', () => {
  assert.equal(planSourceActivation(source('motor-truspeed-repair')).mode, 'provider_agreement_required');
  assert.equal(planSourceActivation(source('motor-truspeed-repair')).usable, false);
});

test('licensed source activates after agreement', () => {
  assert.equal(planSourceActivation(source('motor-truspeed-repair'), true).mode, 'automatic');
});

test('OEM discovery source stays linkout rather than copied content', () => {
  assert.equal(planSourceActivation(source('oem1stop')).mode, 'linkout');
});

test('customer evidence is worldwide governed fallback', () => {
  const decision = planSourceActivation(source('customer-evidence'));
  assert.equal(decision.mode, 'customer_evidence');
  assert.equal(decision.usable, true);
});

test('regional capability lookup excludes unsupported markets', () => {
  assert.ok(sourcesForCapability('parts', 'EU').some(item => item.id === 'tecdoc'));
  assert.equal(sourcesForCapability('parts', 'EU').some(item => item.id === 'autocare-aces-pies'), false);
});
