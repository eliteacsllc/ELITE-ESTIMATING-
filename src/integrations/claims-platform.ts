export type ValuationEvidence = {
  id: string;
  kind: "comparable"|"dealer_quote"|"salvage_bid"|"condition"|"history"|"market_reference"|"other";
  provider: string;
  sourceRecordId?: string;
  retrievedAt: string;
  region?: string;
  licenseClass: "owned"|"licensed"|"public"|"customer_provided"|"internal";
  confidence: number;
};

export type ClaimEstimateSnapshot = {
  estimateId: string;
  revision: number;
  claimId: string;
  activityId: string;
  tenantId: string;
  snapshotRef: string;
  submittedBy: string;
  submittedAt: string;
  valuationEvidence: ValuationEvidence[];
  humanApproved: boolean;
};

export function validateClaimEstimateSnapshot(input: ClaimEstimateSnapshot): ClaimEstimateSnapshot {
  if (!input.estimateId || !input.claimId || !input.activityId || !input.tenantId || !input.snapshotRef) {
    throw new Error("claim_estimate_identity_required");
  }
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new Error("claim_estimate_revision_invalid");
  for (const evidence of input.valuationEvidence) {
    if (!evidence.id || !evidence.provider || !evidence.retrievedAt) throw new Error("valuation_provenance_required");
    if (evidence.confidence < 0 || evidence.confidence > 1) throw new Error("valuation_confidence_invalid");
  }
  return input;
}

export function buildEstimateQaHandoff(input: ClaimEstimateSnapshot) {
  validateClaimEstimateSnapshot(input);
  return {
    schemaVersion:"elite.claims-platform.v1",
    eventType:"estimate.created",
    tenantId:input.tenantId,
    claimId:input.claimId,
    correlationId:input.activityId,
    sourceSystem:"elite-estimating",
    data:{
      estimateId:input.estimateId,
      revision:input.revision,
      immutableSnapshotRef:input.snapshotRef,
      submittedBy:input.submittedBy,
      submittedAt:input.submittedAt,
      valuationEvidence:input.valuationEvidence,
      humanApproved:input.humanApproved
    }
  } as const;
}
