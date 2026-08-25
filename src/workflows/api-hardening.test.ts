import assert from 'node:assert/strict';
import test from 'node:test';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import type { RepairPlanningChecklist } from './repair-planning.js';

const estimator: Principal = { userId: 'workflow-estimator', tenantId: 'tenant-workflow', roles: ['estimator'] };

async function setup() {
  const repository = new InMemoryEstimateRepository();
  const service = new EstimatingService(repository);
  const estimate = await service.create(estimator, {
    tenantId: estimator.tenantId,
    asset: { assetClass: 'passenger_vehicle', year: 2026, make: 'Example', model: 'Vehicle' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
  });
  return { repository, service, estimate };
}

const completeRepairPlan: RepairPlanningChecklist = {
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
  notes: 'CI validated repair plan',
};

test('repair-plan mutation rejects incomplete client payloads and persists validated checklist', async () => {
  const { service, estimate } = await setup();
  await assert.rejects(
    () => service.replaceRepairPlan(estimator, estimate.id, { damageDiscoveryComplete: true } as RepairPlanningChecklist),
    /invalid_repair_plan:/,
  );
  const saved = await service.replaceRepairPlan(estimator, estimate.id, completeRepairPlan);
  assert.deepEqual(saved.repairPlan, completeRepairPlan);
  assert.equal(saved.status, 'review');
});

test('domain workflow is generated from server registry and initialization is retry-safe', async () => {
  const { service, estimate } = await setup();
  const initialized = await service.initializeDomainWorkflow(estimator, estimate.id);
  assert.equal(initialized.domainWorkflow?.domain, 'collision');
  assert.deepEqual(initialized.domainWorkflow?.steps.map(step => step.id), ['blueprint', 'oem', 'parts', 'safety', 'qc']);
  assert.ok(initialized.domainWorkflow?.steps.every(step => step.required && step.status === 'pending'));

  const replay = await service.initializeDomainWorkflow(estimator, estimate.id);
  assert.equal(replay.updatedAt, initialized.updatedAt);
  assert.deepEqual(replay.domainWorkflow, initialized.domainWorkflow);
});

test('domain workflow completion identity is taken from authenticated principal, not request body', async () => {
  const { service, estimate } = await setup();
  await service.initializeDomainWorkflow(estimator, estimate.id);
  const maliciousInput = {
    stepId: 'blueprint',
    status: 'complete',
    evidenceRefs: ['evidence-123', 'evidence-123'],
    note: 'Blueprint reviewed',
    completedBy: 'forged-user',
    completedAt: '2000-01-01T00:00:00.000Z',
  } as never;
  const saved = await service.updateDomainWorkflowStep(estimator, estimate.id, maliciousInput);
  const step = saved.domainWorkflow?.steps.find(item => item.id === 'blueprint');
  assert.equal(step?.status, 'complete');
  assert.equal(step?.completedBy, estimator.userId);
  assert.notEqual(step?.completedAt, '2000-01-01T00:00:00.000Z');
  assert.deepEqual(step?.evidenceRefs, ['evidence-123']);
});

test('domain workflow step updates require server initialization and valid statuses', async () => {
  const { service, estimate } = await setup();
  await assert.rejects(
    () => service.updateDomainWorkflowStep(estimator, estimate.id, { stepId: 'blueprint', status: 'complete' }),
    /domain_workflow_not_initialized/,
  );
  await service.initializeDomainWorkflow(estimator, estimate.id);
  await assert.rejects(
    () => service.updateDomainWorkflowStep(estimator, estimate.id, { stepId: 'blueprint', status: 'forged' } as never),
    /invalid_domain_workflow_status/,
  );
});
