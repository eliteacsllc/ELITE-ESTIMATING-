export type ComparableEvidenceCaptureRequest = {
  comparableId: string;
  sourceUrl: string;
  retrievedAt?: string;
};

export type ComparableEvidenceCaptureResult = {
  comparableId: string;
  sourceUrl: string;
  capturedAt: string;
  contentType: string;
  storageKey: string;
  sha256: string;
  provider: string;
};

export interface ComparableEvidenceCaptureProvider {
  readonly name: string;
  capture(request: ComparableEvidenceCaptureRequest): Promise<ComparableEvidenceCaptureResult>;
}

export function validateComparableEvidenceCapture(result: ComparableEvidenceCaptureResult): ComparableEvidenceCaptureResult {
  if (!result.comparableId?.trim()) throw new Error('capture_comparable_id_required');
  if (!/^https:\/\//i.test(result.sourceUrl)) throw new Error('capture_source_url_invalid');
  if (!result.storageKey?.trim()) throw new Error('capture_storage_key_required');
  if (!/^[a-f0-9]{64}$/i.test(result.sha256)) throw new Error('capture_sha256_invalid');
  if (!result.contentType?.trim()) throw new Error('capture_content_type_required');
  return { ...result };
}
