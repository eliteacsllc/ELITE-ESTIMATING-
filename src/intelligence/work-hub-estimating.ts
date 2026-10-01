export type EstimatingWorkAction =
  | "intake_estimate"
  | "review_supplement"
  | "request_documentation"
  | "qa_review"
  | "human_review";

export interface EstimatingWorkEvent {
  tenantId: string;
  eventId: string;
  body?: string;
  subject?: string;
  claimId?: string;
  jobId?: string;
  vehicleId?: string;
  evidenceIds?: string[];
  provenance?: string[];
  confidence?: number;
}

export interface EstimatingWorkDecision {
  action: EstimatingWorkAction;
  priority: "critical" | "high" | "normal";
  reason: string;
  evidenceIds: string[];
  missing: string[];
  requiresApproval: boolean;
  executionAuthority: false;
}

const SENSITIVE = ["attorney", "lawsuit", "fraud", "injury", "threat", "dispute"];

export function classifyEstimatingWork(event: EstimatingWorkEvent): EstimatingWorkDecision {
  if (!event.tenantId || !event.eventId) throw new Error("tenantId and eventId are required");
  const confidence = event.confidence ?? 0;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("confidence must be between 0 and 1");
  const evidenceIds = event.evidenceIds ?? [];
  const provenance = event.provenance ?? [];
  const missing: string[] = [];
  if (!event.claimId && !event.jobId) missing.push("claim_or_job_context");
  if (evidenceIds.length === 0) missing.push("evidence");
  if (provenance.length === 0) missing.push("provenance");

  const text = `${event.subject ?? ""} ${event.body ?? ""}`.toLowerCase();
  if (SENSITIVE.some(term => text.includes(term))) {
    return decision("human_review", "critical", "sensitive dispute or legal language", event.eventId, evidenceIds, missing, true);
  }
  if (text.includes("supplement")) {
    return decision("review_supplement", "high", "supplement request detected", event.eventId, evidenceIds, missing, true);
  }
  if (text.includes("qa") || text.includes("quality") || text.includes("review estimate")) {
    return decision("qa_review", "high", "estimate quality review requested", event.eventId, evidenceIds, missing, true);
  }
  if (missing.includes("evidence") || missing.includes("provenance") || confidence < 0.75) {
    return decision("request_documentation", "normal", "estimate evidence is incomplete or confidence is below release threshold", event.eventId, evidenceIds, missing, false);
  }
  return decision("intake_estimate", "normal", "estimate request is sufficiently grounded for estimator intake", event.eventId, evidenceIds, missing, false);
}

function decision(action: EstimatingWorkAction, priority: EstimatingWorkDecision["priority"], reason: string, eventId: string, evidenceIds: string[], missing: string[], requiresApproval: boolean): EstimatingWorkDecision {
  return { action, priority, reason, evidenceIds: [eventId, ...evidenceIds], missing, requiresApproval, executionAuthority: false };
}

export function estimatingApprovalGates() {
  return ["estimate_release", "qa_override", "payment", "signature", "legal_attestation", "external_send"] as const;
}

export function assertTenantSafeEstimatingBatch(events: EstimatingWorkEvent[], tenantId: string): void {
  if (!tenantId) throw new Error("tenantId is required");
  const foreign = events.find(event => event.tenantId !== tenantId);
  if (foreign) throw new Error(`cross-tenant event denied: ${foreign.eventId}`);
}
