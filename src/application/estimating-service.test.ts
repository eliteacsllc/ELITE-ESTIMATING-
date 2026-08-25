import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from './estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import type { EstimateLine } from '../domain/types.js';
import type { RepairPlanningChecklist } from '../workflows/repair-planning.js';

const estimator: Principal = { userId: 'u1', tenantId: 'tenant-a', roles: ['estimator'] };
const reviewer: Principal = { userId: 'u2', tenantId: 'tenant-a', roles: ['reviewer'] };

function approvedLine(): EstimateLine {
  return {
    id: 'line-1',
    category: 'body',
    component: 'front bumper',
    operation: 'replace',
    quantity: 1,
    partOrMaterial: { amountMinor: 50000, currency: 'USD' },
    laborHours: 2,
    laborRate: { amountMinor: 7500, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    humanApproved: true,
    provenance: [{ provider: 'customer', retrievedAt: new Date().toISOString(), licenseClass: 'customer_provided' }],
  };
}

function completeRepairPlan(): RepairPlanningChecklist {
  return {
    damageDiscoveryComplete: true,
    teardownBlueprintComplete: true,
    hiddenDamageReviewed: true,
    partsIdentified: true,
    oneTimeUseItemsIdentified: true,
    oemProceduresReviewed: true,
    structuralRequirementsResolved: true,
    adasRequirementsResolved: true,
    evHvRequirementsResolved: true,
    requiredToolsEquipmentConfirmed: true,
    technicianCapabilityConfirmed: true,
    subletOperationsIdentified: true,
    preRepairScanResolved: true,
    calibrationPlanResolved: true,
    postRepairScanResolved: true,
    finalQcPlanResolved: true,
    testDriveOrFunctionalValidationResolved: true,
  };
}

test('tenant-scoped service creates and calculates an estimate', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  const estimate = await service.create(estimator, {
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle', vin: '1TEST' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const updated = await service.replaceLines(estimator, estimate.id, [approvedLine()]);
  assert.equal(updated.total.amountMinor, 65000);
  assert.equal(updated.status, 'review');
  const approved = await service.approve(reviewer, estimate.id);
  assert.equal(approved.status, 'approved');
});

test('cross-tenant creation is denied', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  await assert.rejects(() => service.create(estimator, {
    tenantId: 'tenant-b', asset: { assetClass: 'contents' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  }), /cross_tenant_access_denied/);
});

test('unapproved AI or human lines cannot be approved', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  const estimate = await service.create(estimator, {
    tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const line = { ...approvedLine(), humanApproved: false, aiSuggested: true, aiConfidence: 0.91 };
  await service.replaceLines(estimator, estimate.id, [line]);
  await assert.rejects(() => service.approve(reviewer, estimate.id), /human_approval_required/);
});

test('MOTOR-based estimate requires repair plan before approval', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  const estimate = await service.create(estimator, {
    tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle', year: 2026 }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const line: EstimateLine = {
    ...approvedLine(),
    provenance: [{ provider: 'MOTOR Information Systems', retrievedAt: new Date().toISOString(), licenseClass: 'licensed' }],
    guide: { source: 'motor_gte', partBasis: 'new_oem', workTimeBasis: 'database' },
  };
  await service.replaceLines(estimator, estimate.id, [line]);
  await assert.rejects(() => service.approve(reviewer, estimate.id), /repair_plan_required/);
  await service.replaceRepairPlan(estimator, estimate.id, completeRepairPlan());
  const approved = await service.approve(reviewer, estimate.id);
  assert.equal(approved.status, 'approved');
});

test('incomplete repair plan blocks safety-critical approval', async () => {
  const service = new EstimatingService(new InMemoryEstimateRepository());
  const estimate = await service.create(estimator, {
    tenantId: 'tenant-a', asset: { assetClass: 'passenger_vehicle' }, locale: 'en-US', currency: 'USD', jurisdiction: 'US',
  });
  const line: EstimateLine = {
    ...approvedLine(), safetyCritical: true, procedureRefs: ['OEM:repair-procedure'],
  };
  await service.replaceLines(estimator, estimate.id, [line]);
  const plan = completeRepairPlan();
  plan.oemProceduresReviewed = false;
  await service.replaceRepairPlan(estimator, estimate.id, plan);
  await assert.rejects(() => service.approve(reviewer, estimate.id), /repair_plan_audit_failed:oem_procedures_not_reviewed/);
});
