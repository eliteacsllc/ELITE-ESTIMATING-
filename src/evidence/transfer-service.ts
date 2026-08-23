import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import { authorize } from '../security/rbac.js';
import type { EvidenceBlobStore, EvidenceUploadIntent } from './blob-store.js';
import type { EvidenceRepository } from './repository.js';

export type CreateEvidenceUploadIntentInput = {
  mimeType: string;
  sha256: string;
  fileName?: string;
};

export class EvidenceTransferService {
  constructor(
    private readonly estimates: EstimateRepository,
    private readonly evidence: EvidenceRepository,
    private readonly blobs: EvidenceBlobStore,
  ) {}

  private async assertEstimate(principal: Principal, estimateId: string): Promise<void> {
    const estimate = await this.estimates.getById(principal.tenantId, estimateId);
    if (!estimate) throw new Error('estimate_not_found');
  }

  async createUploadIntent(principal: Principal, estimateId: string, input: CreateEvidenceUploadIntentInput): Promise<EvidenceUploadIntent> {
    authorize(principal, 'evidence:create', principal.tenantId);
    await this.assertEstimate(principal, estimateId);
    return this.blobs.createUploadIntent({
      tenantId: principal.tenantId,
      estimateId,
      mimeType: input.mimeType,
      sha256: input.sha256,
      ...(input.fileName ? { fileName: input.fileName } : {}),
    });
  }

  async createDownloadUrl(principal: Principal, evidenceId: string): Promise<{ url: string; expiresInSeconds: number }> {
    authorize(principal, 'evidence:read', principal.tenantId);
    const asset = await this.evidence.getById(principal.tenantId, evidenceId);
    if (!asset) throw new Error('evidence_not_found');
    const expiresInSeconds = 300;
    return { url: await this.blobs.createDownloadUrl(asset.storageKey, expiresInSeconds), expiresInSeconds };
  }
}
