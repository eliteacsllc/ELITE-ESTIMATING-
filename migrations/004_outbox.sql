CREATE TABLE IF NOT EXISTS integration_outbox (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS integration_outbox_pending_idx
  ON integration_outbox (occurred_at)
  WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS integration_outbox_tenant_aggregate_idx
  ON integration_outbox (tenant_id, aggregate_type, aggregate_id, occurred_at DESC);
