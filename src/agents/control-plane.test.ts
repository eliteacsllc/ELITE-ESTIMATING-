import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProviderCapability } from '../connectors/contracts.js';
import { assertControlPlaneDispatchable, buildControlPlaneEnvelope, shouldLaunchShadowAgent } from './control-plane.js';

const capabilities = new Set<ProviderCapability>([
  'asset_identity','build_configuration','parts','labor_times','labor_rates','market_pricing',
  'oem_procedures','adas_requirements','diagnostics','valuation','property_pricing'
]);

function build() {
  return buildControlPlaneEnvelope({
    tenantId: 'tenant-a',
    estimateId: 'estimate-1',
    estimateRevision: 3,
    assetClass: 'passenger_vehicle',
    entitlements: {
      enabled: ['collision','vin_build','oem_procedures','adas_diagnostics','parts_optimizer','estimate_audit'],
      automationLevel: 'governed_autonomy'
    },
    providerCapabilities: capabilities
  });
}

test('binds every execution lane to tenant, estimate revision and deterministic idempotency', () => {
  const first = build();
  const second = build();
  assert.equal(first.state, 'ready');
  assert.deepEqual(first.lanes.map((lane) => lane.idempotencyKey), second.lanes.map((lane) => lane.idempotencyKey));
  assert.ok(first.lanes.every((lane) => lane.idempotencyKey.includes('tenant-a')));
  assert.ok(first.lanes.every((lane) => lane.idempotencyKey.includes('estimate-1')));
  assert.ok(first.lanes.every((lane) => lane.idempotencyKey.includes('r3')));
  assert.equal(first.automaticFinalApprovalAllowed, false);
});

test('safety-critical lanes use aggressive hedging and zero failure budget', () => {
  const envelope = build();
  const safety = envelope.lanes.find((lane) => lane.lane === 'procedures_safety');
  assert.ok(safety);
  assert.equal(safety.criticality, 'safety_critical');
  assert.equal(safety.performance.maxFailuresBeforeEscalation, 0);
  assert.equal(safety.performance.hedgeAfterMs, 150);
  assert.equal(safety.performance.maxParallelAgents, 4);
  assert.ok(safety.shadowAgents.includes('adas-safety'));
  assert.equal(shouldLaunchShadowAgent(safety, 149, false, false), false);
  assert.equal(shouldLaunchShadowAgent(safety, 150, false, false), true);
});

test('primary failure launches fallback shadow immediately', () => {
  const envelope = build();
  const parts = envelope.lanes.find((lane) => lane.lane === 'parts');
  assert.ok(parts);
  assert.ok(parts.shadowAgents.length > 0);
  assert.equal(shouldLaunchShadowAgent(parts, 0, false, true), true);
  assert.equal(shouldLaunchShadowAgent(parts, 9999, true, false), false);
});

test('stale estimate revision fails closed before dispatch', () => {
  const envelope = build();
  assert.doesNotThrow(() => assertControlPlaneDispatchable(envelope, 3));
  assert.throws(() => assertControlPlaneDispatchable(envelope, 4), /control_plane_stale_revision:3:4/);
});

test('missing provider capability blocks the whole envelope before agents run', () => {
  const envelope = buildControlPlaneEnvelope({
    tenantId: 'tenant-a',
    estimateId: 'estimate-2',
    estimateRevision: 1,
    assetClass: 'passenger_vehicle',
    entitlements: { enabled: ['collision','adas_diagnostics'], automationLevel: 'copilot' },
    providerCapabilities: new Set<ProviderCapability>(['oem_procedures'])
  });
  assert.equal(envelope.state, 'blocked');
  assert.ok(envelope.blockers.some((blocker) => blocker.includes('adas_requirements')));
  assert.ok(envelope.blockers.some((blocker) => blocker.includes('diagnostics')));
  assert.throws(() => assertControlPlaneDispatchable(envelope, 1), /control_plane_blocked/);
});
