CREATE TABLE IF NOT EXISTS estimate_evidence (
  tenant_id TEXT NOT NULL,
  id UUID NOT NULL,
  estimate_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  source_asset_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('photo','document','diagnostic_scan','measurement','video','audio','other')),
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, estimate_id, source_system, source_asset_id),
  FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS estimate_evidence_estimate_idx
  ON estimate_evidence (tenant_id, estimate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS estimate_evidence_kind_idx
  ON estimate_evidence (tenant_id, kind, created_at DESC);
