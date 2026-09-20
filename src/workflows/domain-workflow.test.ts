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

test('untrusted checklist statuses cannot bypass required-step review', () => {
  const state = createDomainWorkflow({ assetClass: 'heavy_equipment' }, 'heavy_equipment');
  const stepId = state.steps[0]!.id;
  assert.throws(() => updateDomainWorkflowStep(state, { stepId, status: 'skipped' as never }), /invalid_status/);
  const tampered = { ...state, steps: state.steps.map((step, index) =>
    index === 0 ? { ...step, status: 'skipped' as never } : { ...step, status: 'not_applicable' as const, note: 'documented' }
  ) };
  const audit = auditDomainWorkflow(tampered);
  assert.equal(audit.green, false);
  assert.ok(audit.blockers.includes('invalid_step_status:' + stepId));
});

test('invalid evidence payload is rejected before checklist state changes', () => {
  const state = createDomainWorkflow({ assetClass: 'rv' }, 'rv');
  const stepId = state.steps[0]!.id;
  assert.throws(() => updateDomainWorkflowStep(state, {
    stepId, status: 'complete', completedBy: 'reviewer', evidenceRefs: 'not-an-array' as never,
  }), /invalid_evidence_refs/);
  assert.throws(() => updateDomainWorkflowStep(state, {
    stepId, status: 'complete', completedBy: 'reviewer', evidenceRefs: [null] as never,
  }), /invalid_evidence_refs/);
  assert.equal(state.steps[0]!.status, 'pending');
});

test('mandatory checklist completion requires evidence on write and audit', () => {
  const state = createDomainWorkflow({ assetClass: 'heavy_equipment' }, 'heavy_equipment');
  const stepId = state.steps[0]!.id;
  assert.equal(state.steps[0]!.required, true);
  assert.throws(() => updateDomainWorkflowStep(state, {
    stepId, status: 'complete', completedBy: 'reviewer', evidenceRefs: [],
  }), /domain_workflow_evidence_required/);
  const forged = { ...state, steps: state.steps.map(step => ({
    ...step, status: 'complete' as const, completedBy: 'reviewer', evidenceRefs: [],
  })) };
  const audit = auditDomainWorkflow(forged);
  assert.equal(audit.green, false);
  assert.ok(audit.blockers.includes('required_completion_without_evidence:' + stepId));
});
