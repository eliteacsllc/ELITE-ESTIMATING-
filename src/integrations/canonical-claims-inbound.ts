export interface CanonicalClaimsEstimateRequest {
  tenantId: string;
  claimId?: string;
  jobId?: string;
  correlationId: string;
  actor: string;
  target: "elite-estimating-os";
  action: string;
  schemaVersion: string;
  idempotencyKey: string;
  createdAt: string;
  payload: {
    inspectionId?: string;
    assignmentId?: string;
    asset?: Record<string, unknown>;
    evidenceIds?: string[];
    findings?: unknown[];
    locale?: string;
    currency?: string;
    jurisdiction?: string;
  };
}

export function validateCanonicalClaimsEstimateRequest(input: Partial<CanonicalClaimsEstimateRequest>): string[] {
  const reasons: string[]=[];
  if(!input.tenantId) reasons.push("tenant_id_required");
  if(!input.claimId&&!input.jobId) reasons.push("claim_or_job_id_required");
  if(!input.correlationId) reasons.push("correlation_id_required");
  if(!input.idempotencyKey) reasons.push("idempotency_key_required");
  if(input.target!=="elite-estimating-os") reasons.push("target_must_be_elite_estimating_os");
  if(!input.action) reasons.push("action_required");
  if(!/^\d+\.\d+\.\d+$/.test(String(input.schemaVersion??""))) reasons.push("schema_version_invalid");
  if(!input.payload||typeof input.payload!=="object") reasons.push("payload_required");
  if(!input.payload?.asset||typeof input.payload.asset!=="object") reasons.push("asset_required");
  return reasons;
}

export function canonicalEstimateResult(input: CanonicalClaimsEstimateRequest, estimateId: string, replayed: boolean, evidenceRefs: string[] = []) {
  return {
    tenantId: input.tenantId,
    claimId: input.claimId,
    jobId: input.jobId,
    correlationId: input.correlationId,
    target: "elite-estimating-os",
    action: input.action,
    status: "accepted",
    resultRef: `elite-estimating:estimate:${estimateId}`,
    version: "1",
    completedAt: new Date().toISOString(),
    provenance: [{ source: "elite-estimating-os", estimateId, replayed }],
    evidenceRefs,
    output: { estimateId, replayed }
  };
}
