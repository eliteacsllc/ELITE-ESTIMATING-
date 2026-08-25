import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDomainWorkflow, createDomainWorkflow, updateDomainWorkflowStep } from './domain-workflow.js';

test('domain workflow starts blocked and becomes green when required steps are completed', () => {
  let state = createDomainWorkflow({ assetClass: 'residential_property' }, 'property', '2026-08-25T12:00:00Z');
  assert.equal(auditDomainWorkflow(state).green, false);
  for (const step of state.steps) {
    state = updateDomainWorkflowStep(state, { stepId: step.id, status: 'complete', completedBy: 'estimator-1', evidenceRefs: [`evidence:${step.id}`] }, '2026-08-25T12:01:00Z');
  }
  assert.equal(auditDomainWorkflow(state).green, true);
});

test('required not-applicable step requires documented reason', () => {
  const state = createDomainWorkflow({ assetClass: 'heavy_equipment' }, 'heavy_equipment');
  assert.throws(() => updateDomainWorkflowStep(state, { stepId: state.steps[0]!.id, status: 'not_applicable' }), /na_reason_required/);
});
