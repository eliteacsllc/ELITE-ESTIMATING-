CREATE TABLE IF NOT EXISTS claims_inspection_inbox (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  inspection_id TEXT NOT NULL,
  assignment_id TEXT,
  package_sha256 TEXT NOT NULL CHECK(length(package_sha256)=64),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  estimate_id TEXT,
  UNIQUE(tenant_id,idempotency_key),
  CHECK(status IN ('queued','processed','rejected'))
);
CREATE INDEX IF NOT EXISTS idx_claims_inspection_inbox_queue ON claims_inspection_inbox(tenant_id,status,received_at);
CREATE INDEX IF NOT EXISTS idx_claims_inspection_inbox_claim ON claims_inspection_inbox(tenant_id,claim_id,received_at DESC);
