CREATE TABLE IF NOT EXISTS tenant_feature_profiles (
  tenant_id TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  enabled_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  automation_level TEXT NOT NULL DEFAULT 'manual',
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, asset_class),
  CONSTRAINT tenant_feature_profiles_automation_check CHECK (automation_level IN ('manual','assisted','copilot','automated_draft','governed_autonomy')),
  CONSTRAINT tenant_feature_profiles_features_array CHECK (jsonb_typeof(enabled_features) = 'array')
);

CREATE INDEX IF NOT EXISTS tenant_feature_profiles_updated_idx ON tenant_feature_profiles (tenant_id, updated_at DESC);
