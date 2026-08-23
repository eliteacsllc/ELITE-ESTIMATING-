import type { SourceProvenance } from '../domain/types.js';

export type EvidenceKind = 'photo' | 'document' | 'diagnostic_scan' | 'measurement' | 'video' | 'audio' | 'other';

export type EvidenceAsset = {
  id: string;
  tenantId: string;
  estimateId: string;
  sourceSystem: string;
  sourceAssetId: string;
  kind: EvidenceKind;
  mimeType: string;
  sha256: string;
  storageKey: string;
  capturedAt?: string;
  metadata: Record<string, unknown>;
  provenance: SourceProvenance[];
  createdAt: string;
};

export type RegisterEvidenceInput = Omit<EvidenceAsset, 'id' | 'tenantId' | 'estimateId' | 'createdAt'>;

export function validateEvidenceInput(input: RegisterEvidenceInput): string[] {
  const errors: string[] = [];
  if (!input.sourceSystem.trim() || input.sourceSystem.length > 100) errors.push('invalid_source_system');
  if (!input.sourceAssetId.trim() || input.sourceAssetId.length > 300) errors.push('invalid_source_asset_id');
  if (!input.mimeType.trim() || input.mimeType.length > 150) errors.push('invalid_mime_type');
  if (!/^[0-9a-f]{64}$/.test(input.sha256)) errors.push('invalid_sha256');
  if (!input.storageKey.trim() || input.storageKey.length > 1000) errors.push('invalid_storage_key');
  if (input.storageKey.includes('..')) errors.push('unsafe_storage_key');
  if (input.provenance.length === 0) errors.push('evidence_provenance_required');
  if (input.capturedAt && Number.isNaN(Date.parse(input.capturedAt))) errors.push('invalid_captured_at');
  return errors;
}
