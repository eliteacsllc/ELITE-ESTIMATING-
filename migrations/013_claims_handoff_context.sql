CREATE TABLE IF NOT EXISTS claims_handoff_context (
  tenant_id TEXT NOT NULL,
  inspection_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  estimate_id TEXT NOT NULL,
  inspection_type TEXT NOT NULL,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id,inspection_id)
);
CREATE INDEX IF NOT EXISTS idx_claims_handoff_claim ON claims_handoff_context(tenant_id,claim_id,received_at DESC);
