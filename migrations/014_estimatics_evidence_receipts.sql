CREATE TABLE IF NOT EXISTS estimatics_evidence_receipts (
  tenant_id TEXT NOT NULL,
  estimate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  claim_id TEXT,
  assignment_id TEXT,
  inspection_id TEXT,
  request_id TEXT NOT NULL,
  consumer TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  source_receipt_digest TEXT NOT NULL,
  envelope_digest TEXT NOT NULL,
  record_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_record_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_human_review BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, estimate_id, envelope_digest)
);

CREATE INDEX IF NOT EXISTS idx_estimatics_receipts_trace
  ON estimatics_evidence_receipts(tenant_id, correlation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimatics_receipts_claim
  ON estimatics_evidence_receipts(tenant_id, claim_id, created_at DESC);
