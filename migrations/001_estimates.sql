BEGIN;

CREATE TABLE IF NOT EXISTS estimates (
  tenant_id TEXT NOT NULL,
  id UUID NOT NULL,
  claim_id TEXT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('draft','review','approved','supplement','void')),
  asset_class TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS estimates_tenant_claim_idx
  ON estimates (tenant_id, claim_id, updated_at DESC)
  WHERE claim_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS estimates_tenant_status_idx
  ON estimates (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS estimates_payload_gin_idx
  ON estimates USING GIN (payload jsonb_path_ops);

COMMIT;
