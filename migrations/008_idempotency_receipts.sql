CREATE TABLE IF NOT EXISTS mutation_idempotency_receipts (
  tenant_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  resource_id UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS mutation_idempotency_expiry_idx
  ON mutation_idempotency_receipts (expires_at);

CREATE INDEX IF NOT EXISTS mutation_idempotency_resource_idx
  ON mutation_idempotency_receipts (tenant_id, operation, resource_id);
