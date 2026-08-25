CREATE TABLE IF NOT EXISTS estimate_decision_records (
  tenant_id TEXT NOT NULL,
  id UUID NOT NULL,
  estimate_id UUID NOT NULL,
  estimate_revision INTEGER NOT NULL CHECK (estimate_revision > 0),
  decision_type TEXT NOT NULL CHECK (decision_type IN ('parts_optimization','repair_replace','total_loss')),
  input_hash CHAR(64) NOT NULL,
  result_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT estimate_decision_records_estimate_fk
    FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT estimate_decision_records_input_hash_check CHECK (input_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS estimate_decision_records_replay_idx
  ON estimate_decision_records (tenant_id, estimate_id, estimate_revision, decision_type, input_hash);

CREATE INDEX IF NOT EXISTS estimate_decision_records_estimate_idx
  ON estimate_decision_records (tenant_id, estimate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS estimate_decision_records_type_idx
  ON estimate_decision_records (tenant_id, decision_type, created_at DESC);
