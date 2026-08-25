import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeParts } from './parts-optimizer.js';
import { decideRepairOrReplace } from './repair-replace.js';
import { analyzeTotalLoss } from './total-loss.js';

const provenance = [{ provider: 'licensed-source', retrievedAt: '2026-08-25T12:00:00Z', licenseClass: 'licensed' as const }];

test('parts optimizer rejects unsafe cheap candidate and selects eligible source', () => {
  const result = optimizeParts([
    { id: 'cheap', description: 'sensor', sourceType: 'aftermarket', price: { amountMinor: 10000, currency: 'USD' }, safetyCriticalApproved: false, oemProcedureCompatible: false, provenance },
    { id: 'safe', description: 'sensor', sourceType: 'new_oem', price: { amountMinor: 20000, currency: 'USD' }, safetyCriticalApproved: true, oemProcedureCompatible: true, warrantyMonths: 36, leadTimeDays: 1, distanceMiles: 10, provenance },
  ], { currency: 'USD', allowedSourceTypes: ['new_oem','aftermarket'], requireSafetyApproval: true, requireOemProcedureCompatibility: true });
  assert.equal(result.selected?.id, 'safe');
  assert.ok(result.rejected.some(item => item.candidateId === 'cheap' && item.reasons.includes('safety_approval_required')));
});

test('repair replace engine prefers replacement when repair exceeds configured economics', () => {
  const result = decideRepairOrReplace(
    { laborHours: 10, laborRate: { amountMinor: 10000, currency: 'USD' }, safetyProcedureSatisfied: true, qualityRestorationFeasible: true, provenance },
    { part: { amountMinor: 50000, currency: 'USD' }, laborHours: 2, laborRate: { amountMinor: 10000, currency: 'USD' }, safetyProcedureSatisfied: true, provenance },
    { currency: 'USD', repairCostRatioThreshold: 0.8 },
  );
  assert.equal(result.recommendation, 'replace');
  assert.equal(result.repairCost.amountMinor, 100000);
  assert.equal(result.replacementCost.amountMinor, 70000);
});

test('safety-critical repair without satisfied procedure does not recommend repair', () => {
  const result = decideRepairOrReplace(
    { laborHours: 1, laborRate: { amountMinor: 1000, currency: 'USD' }, safetyProcedureSatisfied: false, qualityRestorationFeasible: true, provenance },
    { part: { amountMinor: 100000, currency: 'USD' }, laborHours: 1, laborRate: { amountMinor: 1000, currency: 'USD' }, safetyProcedureSatisfied: true, provenance },
    { currency: 'USD', repairCostRatioThreshold: 0.9, safetyCritical: true },
  );
  assert.equal(result.recommendation, 'replace');
  assert.ok(result.blockers.includes('repair_safety_procedure_not_satisfied'));
});

test('total loss engine requires jurisdiction reference before legal-like recommendation', () => {
  const base = {
    currency: 'USD', repairCost: { amountMinor: 800000, currency: 'USD' }, salvageValue: { amountMinor: 250000, currency: 'USD' },
    comparableValues: [
      { id: '1', adjustedValue: { amountMinor: 1000000, currency: 'USD' }, observedAt: '2026-08-20T12:00:00Z', provenance: provenance[0]! },
      { id: '2', adjustedValue: { amountMinor: 1050000, currency: 'USD' }, observedAt: '2026-08-21T12:00:00Z', provenance: provenance[0]! },
      { id: '3', adjustedValue: { amountMinor: 950000, currency: 'USD' }, observedAt: '2026-08-22T12:00:00Z', provenance: provenance[0]! },
    ], policy: { method: 'threshold' as const, thresholdRatio: 0.75 },
  };
  const ungoverned = analyzeTotalLoss(base);
  assert.equal(ungoverned.recommendation, 'manual_review');
  const governed = analyzeTotalLoss({ ...base, jurisdictionReference: 'state-rule-reference' });
  assert.equal(governed.recommendation, 'total_loss_indicator');
});
