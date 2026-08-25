import test from 'node:test';
import assert from 'node:assert/strict';
import type { Estimate } from '../domain/types.js';
import { auditRepairPlan, type RepairPlanningChecklist } from './repair-planning.js';

function estimate(): Estimate {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle', year: 2026, make: 'Example', model: 'EV', configuration: 'electric' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US',
    lines: [
      {
        id: 'radar', category: 'ADAS', component: 'front radar sensor', operation: 'calibrate', quantity: 1,
        laborHours: 1, total: { amountMinor: 10000, currency: 'USD' }, safetyCritical: true,
        procedureRefs: ['OEM:ADAS:front-radar'], humanApproved: true,
        provenance: [{ provider: 'OEM', retrievedAt: '2026-08-25T00:00:00.000Z', licenseClass: 'licensed' }],
      },
    ],
    subtotal: { amountMinor: 10000, currency: 'USD' }, tax: { amountMinor: 0, currency: 'USD' }, total: { amountMinor: 10000, currency: 'USD' },
    status: 'review', revision: 1, createdAt: '2026-08-25T00:00:00.000Z', updatedAt: '2026-08-25T00:00:00.000Z',
  };
}

function complete(): RepairPlanningChecklist {
  return {
    damageDiscoveryComplete: true, teardownBlueprintComplete: true, hiddenDamageReviewed: true,
    partsIdentified: true, oneTimeUseItemsIdentified: true, oemProceduresReviewed: true,
    structuralRequirementsResolved: true, adasRequirementsResolved: true, evHvRequirementsResolved: true,
    requiredToolsEquipmentConfirmed: true, technicianCapabilityConfirmed: true, subletOperationsIdentified: true,
    preRepairScanResolved: true, calibrationPlanResolved: true, postRepairScanResolved: true,
    finalQcPlanResolved: true, testDriveOrFunctionalValidationResolved: true,
  };
}

test('complete repair planning checklist passes', () => {
  assert.equal(auditRepairPlan(estimate(), complete()).length, 0);
});

test('ADAS and EV requirements become blockers when unresolved', () => {
  const checklist = complete();
  checklist.adasRequirementsResolved = false;
  checklist.calibrationPlanResolved = false;
  checklist.evHvRequirementsResolved = false;
  const codes = auditRepairPlan(estimate(), checklist).map((finding) => finding.code);
  assert.ok(codes.includes('adas_requirements_unresolved'));
  assert.ok(codes.includes('calibration_plan_unresolved'));
  assert.ok(codes.includes('ev_hv_requirements_unresolved'));
});

test('blueprinting and OEM procedure review are mandatory', () => {
  const checklist = complete();
  checklist.teardownBlueprintComplete = false;
  checklist.oemProceduresReviewed = false;
  const codes = auditRepairPlan(estimate(), checklist).map((finding) => finding.code);
  assert.ok(codes.includes('blueprint_incomplete'));
  assert.ok(codes.includes('oem_procedures_not_reviewed'));
});
