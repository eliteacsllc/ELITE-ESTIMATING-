import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Estimate } from '../domain/types.js';
import type { Principal } from '../security/rbac.js';
import { InMemoryEvidenceRepository, type EvidenceRepository } from './repository.js';
import { EvidenceService } from './service.js';
import type { EvidenceAsset, RegisterEvidenceInput } from './types.js';

const principal: Principal = { userId: 'user-1', tenantId: 'tenant-a', roles: ['tenant_admin'] };

function estimate(): Estimate {
  const now = new Date().toISOString();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: principal.tenantId,
    asset: { assetClass: 'passenger_vehicle', vin: '1HGCM82633A004352' },
    locale: 'en-US',
    currency: 'USD',
    jurisdiction: 'US',
    lines: [],
    subtotal: { amountMinor: 0, currency: 'USD' },
    tax: { amountMinor: 0, currency: 'USD' },
    total: { amountMinor: 0, currency: 'USD' },
    status: 'draft',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function input(overrides: Partial<RegisterEvidenceInput> = {}): RegisterEvidenceInput {
  return {
    sourceSystem: 'veh-photo-labeler',
    sourceAssetId: 'photo-001',
    kind: 'photo',
    mimeType: 'image/jpeg',
    sha256: 'a'.repeat(64),
    storageKey: 'tenant-a/estimate/photo-001.jpg',
    capturedAt: '2026-08-23T12:00:00.000Z',
    metadata: { label: 'front-left' },
    provenance: [{ provider: 'veh-photo-labeler', retrievedAt: '2026-08-23T12:01:00.000Z', licenseClass: 'customer_provided' }],
    ...overrides,
  };
}

async function setup(repository: EvidenceRepository = new InMemoryEvidenceRepository()): Promise<EvidenceService> {
  const estimates = new InMemoryEstimateRepository();
  await estimates.create(estimate());
  return new EvidenceService(estimates, repository);
}

test('evidence registration replays the existing asset for the same immutable source identity', async () => {
  const service = await setup();
  const first = await service.register(principal, estimate().id, input());
  const second = await service.register(principal, estimate().id, input({
    metadata: { label: 'front-left', clientRetry: true },
    provenance: [{ provider: 'veh-photo-labeler', retrievedAt: '2026-08-23T12:05:00.000Z', licenseClass: 'customer_provided' }],
  }));
  assert.equal(second.id, first.id);
  assert.equal(second.sha256, first.sha256);
});

test('evidence registration rejects reuse of a source identity for a different object', async () => {
  const service = await setup();
  await service.register(principal, estimate().id, input());
  await assert.rejects(
    service.register(principal, estimate().id, input({ sha256: 'b'.repeat(64) })),
    /evidence_source_conflict/,
  );
});

test('evidence registration resolves a concurrent duplicate insert to the stored asset', async () => {
  const base = new InMemoryEvidenceRepository();
  let firstCreate = true;
  const racingRepository: EvidenceRepository = {
    getById: (...args) => base.getById(...args),
    getBySource: (...args) => base.getBySource(...args),
    listByEstimate: (...args) => base.listByEstimate(...args),
    async create(asset: EvidenceAsset): Promise<EvidenceAsset> {
      if (!firstCreate) return base.create(asset);
      firstCreate = false;
      await base.create(asset);
      throw new Error('evidence_source_already_registered');
    },
  };
  const service = await setup(racingRepository);
  const registered = await service.register(principal, estimate().id, input());
  assert.equal(registered.sourceAssetId, 'photo-001');
  assert.equal(registered.sha256, 'a'.repeat(64));
});
