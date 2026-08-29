import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { InMemoryTenantFeatureProfileRepository } from '../platform/entitlement-repository.js';
import { TenantEntitlementService } from '../platform/entitlement-service.js';
import type { Principal } from '../security/rbac.js';
import { AgentMeshPlanningService } from './planning-service.js';

const admin: Principal = { userId: 'admin-a', tenantId: 'tenant-a', roles: ['tenant_admin'] };

async function fixture() {
  const estimates = new InMemoryEstimateRepository();
  const estimating = new EstimatingService(estimates);
  const entitlements = new TenantEntitlementService(new InMemoryTenantFeatureProfileRepository());
  const planning = new AgentMeshPlanningService(estimates, entitlements);
  const estimate = await estimating.create(admin, {
    tenantId: 'tenant-a',
    asset: { assetClass: 'passenger_vehicle', vin: '1HGBH41JXMN109186', year: 2026, make: 'Honda', model: 'Accord' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US-DE',
  });
  return { estimate, entitlements, planning };
}

test('returns read-only governed plan with harmonized free-first sourcing for an entitled feature', async () => {
  const { estimate, entitlements, planning } = await fixture();
  await entitlements.set(admin, { assetClass: 'passenger_vehicle', enabledFeatures: ['parts_optimizer'], automationLevel: 'copilot' });
  const plan = await planning.plan(admin, estimate.id, { feature: 'parts_optimizer', criticality: 'important', utilization: 0.6 });
  assert.equal(plan.estimateId, estimate.id);
  assert.equal(plan.estimateRevision, 1);
  assert.equal(plan.feature, 'parts_optimizer');
  assert.equal(plan.superAgent.id, 'parts-pricing-supervisor');
  assert.ok(plan.primary.agentId.length > 0);
  assert.ok(plan.shadows.length >= 1);
  assert.equal(plan.sourcePlan.paidProviderArchitecturallyRequired, false);
  assert.ok(plan.sourcePlan.automaticCapabilities.includes('safety_recalls'));
  assert.equal(plan.sourcePlan.coverage.find(item => item.capability === 'safety_recalls')?.status, 'free_covered');
  assert.ok(plan.sourcePlan.customerEvidenceCapabilities.includes('parts'));
  assert.ok(plan.sourcePlan.customerEvidenceCapabilities.includes('market_pricing'));
  assert.equal(plan.humanApprovalRequired, true);
  assert.equal(plan.automaticFinalMutationAllowed, false);
  assert.ok(Date.parse(plan.ticketExpiresAt) > Date.now());
});

test('rejects planning for a feature the tenant did not enable', async () => {
  const { estimate, planning } = await fixture();
  await assert.rejects(
    () => planning.plan(admin, estimate.id, { feature: 'parts_optimizer', criticality: 'important', utilization: 0.5 }),
    /feature_not_entitled:parts_optimizer/,
  );
});

test('rejects invalid criticality and utilization before execution planning', async () => {
  const { estimate, entitlements, planning } = await fixture();
  await entitlements.set(admin, { assetClass: 'passenger_vehicle', enabledFeatures: ['parts_optimizer'], automationLevel: 'assisted' });
  await assert.rejects(
    () => planning.plan(admin, estimate.id, { feature: 'parts_optimizer', criticality: 'important', utilization: 1.1 }),
    /invalid_agent_mesh_utilization/,
  );
  await assert.rejects(
    () => planning.plan(admin, estimate.id, { feature: 'parts_optimizer', criticality: 'invalid' as never, utilization: 0.5 }),
    /invalid_agent_mesh_criticality/,
  );
});
