import { randomUUID } from 'node:crypto';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { EvidenceBlobStore } from './blob-store.js';
import type { EvidenceRepository } from './repository.js';
import type { EvidenceAsset, RegisterEvidenceInput } from './types.js';
import { validateEvidenceInput } from './types.js';

export class EvidenceService {
  constructor(
    private readonly estimates: EstimateRepository,
    private readonly evidence: EvidenceRepository,
    private readonly blobs?: EvidenceBlobStore,
  ) {}

  private async assertEstimate(principal: Principal, estimateId: string): Promise<void> {
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
  }

  async register(principal: Principal, estimateId: string, input: RegisterEvidenceInput): Promise<EvidenceAsset> {
    authorize(principal, 'evidence:create', principal.tenantId);
    await this.assertEstimate(principal, estimateId);
    const errors = validateEvidenceInput(input);
    if (errors.length) throw new Error(`validation_failed:${errors.join('|')}`);
    if (this.blobs) {
      const verified = await this.blobs.verifyObject(input.storageKey.trim(), input.sha256);
      if (!verified) throw new Error('evidence_blob_checksum_mismatch');
    }
    const asset: EvidenceAsset = {
      id: randomUUID(),
      tenantId: principal.tenantId,
      estimateId,
      sourceSystem: input.sourceSystem.trim(),
      sourceAssetId: input.sourceAssetId.trim(),
      kind: input.kind,
      mimeType: input.mimeType.trim().toLowerCase(),
      sha256: input.sha256,
      storageKey: input.storageKey.trim(),
      ...(input.capturedAt ? { capturedAt: new Date(input.capturedAt).toISOString() } : {}),
      metadata: structuredClone(input.metadata),
      provenance: structuredClone(input.provenance),
      createdAt: new Date().toISOString(),
    };
    return this.evidence.create(asset);
  }

  async list(principal: Principal, estimateId: string): Promise<EvidenceAsset[]> {
    authorize(principal, 'evidence:read', principal.tenantId);
    await this.assertEstimate(principal, estimateId);
    return this.evidence.listByEstimate(principal.tenantId, estimateId);
  }
}
