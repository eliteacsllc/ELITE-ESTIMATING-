import type { AssetIdentity } from '../domain/types.js';
import { domainForAsset, type DomainEstimatePlan, type EstimatingDomainId } from '../domains/registry.js';

export type DomainWorkflowStep = {
  id: string;
  required: boolean;
  reason: string;
  status: 'pending' | 'complete' | 'not_applicable';
  evidenceRefs: string[];
  completedBy?: string;
  completedAt?: string;
  note?: string;
};

export type DomainWorkflowState = {
  domain: EstimatingDomainId;
  createdAt: string;
  updatedAt: string;
  steps: DomainWorkflowStep[];
};

export type DomainWorkflowAudit = {
  green: boolean;
  blockers: string[];
  warnings: string[];
};

function stateFromPlan(plan: DomainEstimatePlan, now: string): DomainWorkflowState {
  return {
    domain: plan.domain,
    createdAt: now,
    updatedAt: now,
    steps: plan.checklist.map(item => ({ id: item.id, required: item.required, reason: item.reason, status: 'pending', evidenceRefs: [] })),
  };
}

export function createDomainWorkflow(asset: AssetIdentity, preferredDomain?: EstimatingDomainId, now = new Date().toISOString()): DomainWorkflowState {
  return stateFromPlan(domainForAsset(asset, preferredDomain).plan(asset), now);
}

export type UpdateDomainWorkflowStepInput = {
  stepId: string;
  status: DomainWorkflowStep['status'];
  evidenceRefs?: string[];
  completedBy?: string;
  note?: string;
  completedAt?: string;
};

export function updateDomainWorkflowStep(state: DomainWorkflowState, input: UpdateDomainWorkflowStepInput, now = new Date().toISOString()): DomainWorkflowState {
  const index = state.steps.findIndex(step => step.id === input.stepId);
  if (index < 0) throw new Error(`domain_workflow_step_not_found:${input.stepId}`);
  const current = state.steps[index]!;
  if (input.status === 'complete' && !input.completedBy?.trim()) throw new Error(`domain_workflow_completed_by_required:${input.stepId}`);
  if (input.status === 'not_applicable' && current.required && !input.note?.trim()) throw new Error(`domain_workflow_na_reason_required:${input.stepId}`);
  const evidenceRefs = [...new Set((input.evidenceRefs ?? current.evidenceRefs).map(value => value.trim()).filter(Boolean))];
  const next: DomainWorkflowStep = {
    ...current,
    status: input.status,
    evidenceRefs,
    ...(input.completedBy?.trim() ? { completedBy: input.completedBy.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...((input.status === 'complete' || input.status === 'not_applicable') ? { completedAt: input.completedAt ?? now } : {}),
  };
  const steps = state.steps.map((step, i) => i === index ? next : step);
  return { ...state, steps, updatedAt: now };
}

export function auditDomainWorkflow(state: DomainWorkflowState): DomainWorkflowAudit {
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const step of state.steps) {
    if (step.required && step.status === 'pending') blockers.push(`required_step_pending:${step.id}`);
    if (step.status === 'complete' && !step.completedBy?.trim()) blockers.push(`completed_by_missing:${step.id}`);
    if (step.required && step.status === 'not_applicable' && !step.note?.trim()) blockers.push(`na_reason_missing:${step.id}`);
    if (step.status === 'complete' && step.evidenceRefs.length === 0) warnings.push(`completion_without_evidence:${step.id}`);
  }
  return { green: blockers.length === 0, blockers, warnings };
}

export function assertDomainWorkflowComplete(state: DomainWorkflowState): DomainWorkflowAudit {
  const audit = auditDomainWorkflow(state);
  if (!audit.green) throw new Error(`domain_workflow_incomplete:${audit.blockers.join('|')}`);
  return audit;
}
