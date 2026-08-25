import assert from 'node:assert/strict';
import test from 'node:test';
import type { Principal } from '../security/rbac.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryTenantFeatureProfileRepository } from '../platform/entitlement-repository.js';
import { TenantEntitlementService } from '../platform/entitlement-service.js';
import { InMemoryDecisionRecordRepository } from './repository.js';
import { GovernedDecisionService, type PartsDecisionInput, type RepairReplaceDecisionInput } from './service.js';

const admin: Principal = { userId: 'admin', tenantId: 'tenant-a', roles: ['tenant_admin'] };
const estimator: Principal = { userId: 'estimator', tenantId: 'tenant-a', roles: ['estimator'] };

async function setup() {
  const estimates = new InMemoryEstimateRepository();
  const estimating = new EstimatingService(estimates);
  const estimate = await estimating.create(estimator, {
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle', year: 2026, make: 'Example', model: 'Vehicle' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const entitlementRepository = new InMemoryTenantFeatureProfileRepository();
  const entitlements = new TenantEntitlementService(entitlementRepository);
  const decisions = new InMemoryDecisionRecordRepository();
  const service = new GovernedDecisionService(estimates, entitlements, decisions);
  return { estimates, estimating, estimate, entitlements, decisions, service };
}

const provenance = { provider: 'licensed-provider', retrievedAt: '2026-08-25T12:00:00.000Z', licenseClass: 'licensed' as const };

test('disabled advanced feature rejects execution', async () => {
  const { estimate, service } = await setup();
  await assert.rejects(() => service.optimizeParts(estimator, estimate.id, {
    candidates: [{ id: 'p1', description: 'panel', sourceType: 'new_oem', price: { amountMinor: 10000, currency: 'USD' }, provenance: [provenance] }],
    policy: { currency: 'USD', allowedSourceTypes: ['new_oem'] },
  }), /feature_not_entitled:parts_optimizer/);
});

test('entitled parts optimization persists a revision-bound decision and exact retry replays it', async () => {
  const { estimate, entitlements, decisions, service } = await setup();
  await entitlements.set(admin, { assetClass: 'passenger_vehicle', enabledFeatures: ['parts_optimizer'], automationLevel: 'assisted' });
  const input: PartsDecisionInput = {
    candidates: [
      { id: 'oem', description: 'panel', sourceType: 'new_oem', price: { amountMinor: 25000, currency: 'USD' }, leadTimeDays: 1, certification: 'OEM', warrantyMonths: 36, oemProcedureCompatible: true, provenance: [provenance] },
      { id: 'recycled', description: 'panel', sourceType: 'recycled', price: { amountMinor: 15000, currency: 'USD' }, leadTimeDays: 3, conditionGrade: 'A', warrantyMonths: 6, oemProcedureCompatible: true, provenance: [provenance] },
    ],
    policy: { currency: 'USD', allowedSourceTypes: ['new_oem','recycled'], requireOemProcedureCompatibility: true },
  };
  const first = await service.optimizeParts(estimator, estimate.id, input);
  assert.equal(first.replayed, false);
  assert.equal(first.record.estimateRevision, estimate.revision);
  assert.equal(first.record.decisionType, 'parts_optimization');
  assert.match(first.record.inputHash, /^[0-9a-f]{64}$/);
  assert.ok(first.result.selected);

  const replay = await service.optimizeParts(estimator, estimate.id, input);
  assert.equal(replay.replayed, true);
  assert.equal(replay.record.id, first.record.id);

  const changed: PartsDecisionInput = {
    ...input,
    candidates: [{ ...input.candidates[0]!, price: { amountMinor: 26000, currency: 'USD' } }, input.candidates[1]!],
  };
  const changedResult = await service.optimizeParts(estimator, estimate.id, changed);
  assert.equal(changedResult.replayed, false);
  assert.notEqual(changedResult.record.id, first.record.id);
  const rows = await decisions.listByEstimate('tenant-a', estimate.id);
  assert.equal(rows.length, 2);
});

test('repair-replace decision requires entitlement and estimate currency', async () => {
  const { estimate, entitlements, service } = await setup();
  await entitlements.set(admin, { assetClass: 'passenger_vehicle', enabledFeatures: ['repair_replace'], automationLevel: 'copilot' });
  const input: RepairReplaceDecisionInput = {
    repair: { laborHours: 5, laborRate: { amountMinor: 8000, currency: 'USD' }, safetyProcedureSatisfied: true, qualityRestorationFeasible: true, provenance: [provenance] },
    replacement: { part: { amountMinor: 70000, currency: 'USD' }, laborHours: 2, laborRate: { amountMinor: 8000, currency: 'USD' }, safetyProcedureSatisfied: true, provenance: [provenance] },
    policy: { currency: 'USD', repairCostRatioThreshold: 0.7 },
  };
  const result = await service.repairOrReplace(estimator, estimate.id, input);
  assert.equal(result.record.decisionType, 'repair_replace');
  await assert.rejects(() => service.repairOrReplace(estimator, estimate.id, {
    ...input,
    policy: { ...input.policy, currency: 'EUR' },
  }), /decision_currency_mismatch/);
});

test('total loss remains manual review without jurisdiction rule reference and is persisted', async () => {
  const { estimate, entitlements, service } = await setup();
  await entitlements.set(admin, { assetClass: 'passenger_vehicle', enabledFeatures: ['total_loss'], automationLevel: 'assisted' });
  const result = await service.totalLoss(estimator, estimate.id, {
    currency: 'USD',
    repairCost: { amountMinor: 900000, currency: 'USD' },
    salvageValue: { amountMinor: 200000, currency: 'USD' },
    comparableValues: [
      { id: 'c1', adjustedValue: { amountMinor: 1000000, currency: 'USD' }, observedAt: '2026-08-20T00:00:00.000Z', provenance },
      { id: 'c2', adjustedValue: { amountMinor: 1020000, currency: 'USD' }, observedAt: '2026-08-21T00:00:00.000Z', provenance },
      { id: 'c3', adjustedValue: { amountMinor: 980000, currency: 'USD' }, observedAt: '2026-08-22T00:00:00.000Z', provenance },
    ],
    policy: { method: 'threshold', thresholdRatio: 0.75 },
  });
  assert.equal(result.result.recommendation, 'manual_review');
  assert.ok(result.result.warnings.includes('jurisdiction_rule_reference_required_for_legal_determination'));
  assert.equal(result.record.decisionType, 'total_loss');
});

test('decision history is tenant-scoped through estimate lookup', async () => {
  const { estimate, service } = await setup();
  const other: Principal = { userId: 'other', tenantId: 'tenant-b', roles: ['estimator'] };
  await assert.rejects(() => service.list(other, estimate.id), /estimate_not_found/);
});
