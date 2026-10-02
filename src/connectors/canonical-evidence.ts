export interface CanonicalEvidence {
  id: string;
  claimId: string;
  assignmentId?: string | null;
  assetId?: string | null;
  storageUri: string;
  sequence: number;
  label?: string | null;
  note?: string | null;
  sha256?: string | null;
}

export interface EstimateEvidenceReference {
  evidenceId: string;
  uri: string;
  sequence: number;
  label: string | null;
  note: string | null;
}

export function toEstimateEvidence(item: CanonicalEvidence): EstimateEvidenceReference {
  if (!item.id || !item.claimId || !item.storageUri) {
    throw new Error("invalid canonical evidence");
  }
  return {
    evidenceId: item.id,
    uri: item.storageUri,
    sequence: item.sequence,
    label: item.label ?? null,
    note: item.note ?? item.label ?? null,
  };
}
