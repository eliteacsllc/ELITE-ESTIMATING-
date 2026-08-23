CREATE TABLE IF NOT EXISTS estimate_damage_graphs (
  tenant_id TEXT NOT NULL,
  estimate_id UUID NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  graph JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, estimate_id, revision),
  FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS estimate_damage_graphs_latest_idx
  ON estimate_damage_graphs (tenant_id, estimate_id, revision DESC);
