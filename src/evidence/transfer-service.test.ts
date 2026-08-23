import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import type { Principal } from '../security/rbac.js';
import type { EvidenceBlobStore, EvidenceUploadIntentInput } from './blob-store.js';
import { InMemoryEvidenceRepository } from './repository.js';
import { EvidenceService } from './service.js';
import { EvidenceTransferService } from './transfer-service.js';

class FakeBlobStore implements EvidenceBlobStore {
  verified = true;
  async createUploadIntent(input: EvidenceUploadIntentInput) {
    return {
      storageKey: `evidence/${input.tenantId}/${input.estimateId}/photo.jpg`,
      uploadUrl: 'https://storage.example/upload',
      method: 'PUT' as const,
      headers: { 'content-type': input.mimeType },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }
  async verifyObject(): Promise<boolean> { return this.verified; }
  async createDownloadUrl(): Promise<string> { return 'https://storage.example/download'; }
}

const principal: Principal = { userId: 'u1', tenantId: 't1', roles: ['appraiser'] };
const sha = 'a'.repeat(64);

async function fixture() {
  const estimates = new InMemoryEstimateRepository();
  const estimate = await new EstimatingService(estimates).create(principal, {
    tenantId: principal.tenantId,
    asset: { assetClass: 'passenger_vehicle', vin: 'JTMAB3FV0PD000001' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US-FL',
  });
  const evidence = new InMemoryEvidenceRepository();
  const blobs = new FakeBlobStore();
  return { estimate, evidence, blobs };
}

test('upload intents are tenant and estimate scoped', async () => {
  const { estimate, evidence, blobs } = await fixture();
  const transfer = new EvidenceTransferService(new InMemoryEstimateRepository(), evidence, blobs);
  await assert.rejects(() => transfer.createUploadIntent(principal, estimate.id, { mimeType: 'image/jpeg', sha256: sha }), /estimate_not_found/);
});

test('evidence registration rejects unverified blob checksums', async () => {
  const estimates = new InMemoryEstimateRepository();
  const estimate = await new EstimatingService(estimates).create(principal, {
    tenantId: principal.tenantId,
    asset: { assetClass: 'passenger_vehicle', vin: 'JTMAB3FV0PD000001' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US-FL',
  });
  const blobs = new FakeBlobStore();
  blobs.verified = false;
  const service = new EvidenceService(estimates, new InMemoryEvidenceRepository(), blobs);
  await assert.rejects(() => service.register(principal, estimate.id, {
    sourceSystem: 'veh-photo-labeler', sourceAssetId: 'photo-1', kind: 'photo', mimeType: 'image/jpeg', sha256: sha,
    storageKey: `evidence/${principal.tenantId}/${estimate.id}/photo.jpg`, metadata: {},
    provenance: [{ provider: 'veh-photo-labeler', retrievedAt: new Date().toISOString(), licenseClass: 'owned' }],
  }), /evidence_blob_checksum_mismatch/);
});

test('verified evidence receives a signed download url', async () => {
  const estimates = new InMemoryEstimateRepository();
  const estimate = await new EstimatingService(estimates).create(principal, {
    tenantId: principal.tenantId,
    asset: { assetClass: 'passenger_vehicle', vin: 'JTMAB3FV0PD000001' },
    locale: 'en-US', currency: 'USD', jurisdiction: 'US-FL',
  });
  const evidence = new InMemoryEvidenceRepository();
  const blobs = new FakeBlobStore();
  const service = new EvidenceService(estimates, evidence, blobs);
  const asset = await service.register(principal, estimate.id, {
    sourceSystem: 'veh-photo-labeler', sourceAssetId: 'photo-1', kind: 'photo', mimeType: 'image/jpeg', sha256: sha,
    storageKey: `evidence/${principal.tenantId}/${estimate.id}/photo.jpg`, metadata: {},
    provenance: [{ provider: 'veh-photo-labeler', retrievedAt: new Date().toISOString(), licenseClass: 'owned' }],
  });
  const transfer = new EvidenceTransferService(estimates, evidence, blobs);
  const download = await transfer.createDownloadUrl(principal, asset.id);
  assert.match(download.url, /^https:\/\//);
  assert.equal(download.expiresInSeconds, 300);
});
