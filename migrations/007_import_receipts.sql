CREATE TABLE IF NOT EXISTS estimate_import_receipts (
  tenant_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_estimate_id TEXT NOT NULL,
  local_estimate_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, source_system, source_estimate_id),
  FOREIGN KEY (tenant_id, local_estimate_id) REFERENCES estimates(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS estimate_import_receipts_local_idx
  ON estimate_import_receipts (tenant_id, local_estimate_id);
