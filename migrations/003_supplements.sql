CREATE TABLE IF NOT EXISTS supplements (
  tenant_id TEXT NOT NULL,
  id UUID NOT NULL,
  estimate_id UUID NOT NULL,
  base_revision INTEGER NOT NULL CHECK (base_revision > 0),
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','rejected')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS supplements_estimate_idx
  ON supplements (tenant_id, estimate_id, created_at DESC);
