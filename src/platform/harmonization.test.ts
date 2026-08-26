import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderCapability } from '../connectors/contracts.js';
import { assertFeatureHarmonyReady, buildFeatureHarmonyPlan } from './harmonization.js';

const capabilities = new Set<ProviderCapability>([
  'asset_identity','build_configuration','parts','labor_times','labor_rates','market_pricing',
  'oem_procedures','adas_requirements','diagnostics','valuation','property_pricing'
]);

test('harmonizes overlapping safety features into one governed execution lane', () => {
  const plan = buildFeatureHarmonyPlan({
    enabled: ['collision','oem_procedures','icar_blueprint','adas_diagnostics','estimate_audit'],
    automationLevel: 'copilot'
  }, 'passenger_vehicle', capabilities);

  const lane = plan.lanes.find((item) => item.lane === 'procedures_safety');
  assert.ok(lane);
  assert.equal(lane.canonicalOwner, 'adas_diagnostics');
  assert.deepEqual(lane.participants, ['adas_diagnostics','oem_procedures','icar_blueprint']);
  assert.deepEqual(lane.suppressedDuplicateExecutions, ['oem_procedures','icar_blueprint']);
  assert.equal(lane.criticality, 'safety_critical');
  assert.equal(lane.meshPrimary, 'oem-procedure');
  assert.ok(lane.meshShadows.includes('adas-safety'));
  assert.equal(plan.humanApprovalRequired, true);
  assert.equal(plan.automaticFinalApprovalAllowed, false);
  assert.deepEqual(plan.blockers, []);
});

test('routes standalone fraud and carrier features to their dedicated specialists', () => {
  const fraudPlan = buildFeatureHarmonyPlan({
    enabled: ['collision','fraud_anomaly'], automationLevel: 'assisted'
  }, 'passenger_vehicle', capabilities);
  const fraudLane = fraudPlan.lanes.find((item) => item.lane === 'audit_compliance');
  assert.ok(fraudLane);
  assert.equal(fraudLane.meshPrimary, 'fraud-anomaly');

  const carrierPlan = buildFeatureHarmonyPlan({
    enabled: ['collision','carrier_compliance'], automationLevel: 'assisted'
  }, 'passenger_vehicle', capabilities);
  const carrierLane = carrierPlan.lanes.find((item) => item.lane === 'audit_compliance');
  assert.ok(carrierLane);
  assert.equal(carrierLane.meshPrimary, 'carrier-rules');
});

test('fails closed when an enabled feature lacks a certified provider capability', () => {
  const plan = buildFeatureHarmonyPlan({
    enabled: ['collision','vin_build','parts_optimizer'],
    automationLevel: 'assisted'
  }, 'passenger_vehicle', new Set<ProviderCapability>(['asset_identity']));

  assert.ok(plan.blockers.includes('provider_capability_missing:vin_build:build_configuration'));
  assert.ok(plan.blockers.includes('provider_capability_missing:parts_optimizer:parts'));
  assert.throws(() => assertFeatureHarmonyReady(plan), /feature_harmony_blocked/);
});

test('deduplicates overlapping labor intelligence while retaining every participant', () => {
  const plan = buildFeatureHarmonyPlan({
    enabled: ['collision','motor_raced','deg_intelligence'],
    automationLevel: 'assisted'
  }, 'passenger_vehicle', capabilities);

  const lane = plan.lanes.find((item) => item.lane === 'labor_pricing');
  assert.ok(lane);
  assert.equal(lane.canonicalOwner, 'motor_raced');
  assert.ok(lane.participants.includes('labor_intelligence'));
  assert.ok(lane.participants.includes('deg_intelligence'));
  assert.ok(lane.suppressedDuplicateExecutions.includes('labor_intelligence'));
  assert.ok(lane.suppressedDuplicateExecutions.includes('deg_intelligence'));
});

test('governed autonomy remains draft-only for final estimate actions', () => {
  const plan = buildFeatureHarmonyPlan({
    enabled: ['collision','estimate_audit','super_appraiser','repair_replace'],
    automationLevel: 'governed_autonomy'
  }, 'passenger_vehicle', capabilities);

  assert.equal(plan.automaticFinalApprovalAllowed, false);
  assert.equal(plan.humanApprovalRequired, true);
  assert.ok(plan.warnings.includes('governed_autonomy_is_draft_only_for_final_estimate_actions'));
});
