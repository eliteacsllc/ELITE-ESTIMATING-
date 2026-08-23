import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import type { Estimate } from '../domain/types.js';
import { nextUpdatedAt } from '../domain/versioning.js';
import type { Principal } from '../security/rbac.js';
import type { Supplement } from '../workflows/supplement.js';
import { PostgresEstimateRepository } from './postgres.js';
import { PostgresSupplementRepository } from './supplements.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const tenantId = `ci-transaction-${randomUUID()}`;
const principal: Principal = { userId: 'ci-reviewer', tenantId, roles: ['tenant_admin'] };
void principal;

function baseEstimate(id: string): Estimate {
  return {
    id,
    tenantId,
    asset: { assetClass: 'passenger_vehicle' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    status: 'approved',
    revision: 1,
    createdAt: '2026-08-23T15:00:00.000Z',
    updatedAt: '2026-08-23T15:00:00.000Z',
  };
}

function submittedSupplement(id: string, estimateId: string): Supplement {
  return {
    id,
    estimateId,
    baseRevision: 1,
    changes: [],
    status: 'submitted',
    createdAt: '2026-08-23T15:01:00.000Z',
  };
}

const estimates = new PostgresEstimateRepository(databaseUrl);
const supplements = new PostgresSupplementRepository(databaseUrl);
try {
  const estimateA = baseEstimate(randomUUID());
  const supplementA = submittedSupplement(randomUUID(), estimateA.id);
  await estimates.create(estimateA);
  await supplements.create(tenantId, supplementA);
  const approvedA: Supplement = { ...supplementA, status: 'approved' };
  const appliedA: Estimate = {
    ...estimateA,
    revision: 2,
    status: 'supplement',
    updatedAt: nextUpdatedAt(estimateA.updatedAt, Date.parse('2026-08-23T15:00:00.000Z')),
  };
  const committed = await supplements.approveAndApply(tenantId, approvedA, appliedA, estimateA.updatedAt);
  assert.equal(committed.supplement.status, 'approved');
  assert.equal(committed.estimate.revision, 2);
  assert.equal((await supplements.getById(tenantId, supplementA.id))?.status, 'approved');
  assert.equal((await estimates.getById(tenantId, estimateA.id))?.revision, 2);

  const estimateB = baseEstimate(randomUUID());
  const supplementB = submittedSupplement(randomUUID(), estimateB.id);
  await estimates.create(estimateB);
  await supplements.create(tenantId, supplementB);
  const changedB: Estimate = { ...estimateB, status: 'review', updatedAt: nextUpdatedAt(estimateB.updatedAt) };
  await estimates.save(changedB, estimateB.updatedAt);
  const approvedB: Supplement = { ...supplementB, status: 'approved' };
  const staleAppliedB: Estimate = { ...estimateB, revision: 2, status: 'supplement', updatedAt: nextUpdatedAt(estimateB.updatedAt) };
  await assert.rejects(
    supplements.approveAndApply(tenantId, approvedB, staleAppliedB, estimateB.updatedAt),
    /estimate_concurrent_modification/,
  );
  assert.equal((await supplements.getById(tenantId, supplementB.id))?.status, 'submitted');
  assert.equal((await estimates.getById(tenantId, estimateB.id))?.status, 'review');
  console.log('postgres supplement transaction smoke passed');
} finally {
  await supplements.close();
  await estimates.close();
}
