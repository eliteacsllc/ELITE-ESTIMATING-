# Tenant Feature Entitlements

Elite Estimating is a modular platform. Advanced capabilities are optional by tenant and asset class; disabling an optional module must not break core manual estimating.

## Persistence model

Profiles are stored by `(tenant_id, asset_class)` in `tenant_feature_profiles`.

Each profile stores:

- selected asset class;
- resolved enabled features, including required dependencies;
- automation level (`manual`, `assisted`, `copilot`, `automated_draft`, or `governed_autonomy`);
- actor who last changed the profile;
- creation/update timestamps.

No saved profile means the safe default: `manual` with no premium features.

## Authorization

Authenticated tenant users with estimate-read permission may read feature profiles. Only `tenant_admin` or `platform_admin` may change them through `features:configure`.

Profiles are always tenant-scoped. One tenant cannot read or mutate another tenant's configuration through these endpoints.

## API

- `GET /v1/platform/features` — list saved profiles for the authenticated tenant.
- `GET /v1/platform/features/:assetClass` — return the saved profile or the safe manual default.
- `PUT /v1/platform/features/:assetClass` — persist a profile. Body:

```json
{
  "enabledFeatures": ["motor_raced", "adas_diagnostics"],
  "automationLevel": "copilot"
}
```

The server resolves dependencies before saving. For example, `motor_raced` adds `labor_intelligence`; `adas_diagnostics` adds `oem_procedures`.

Invalid feature IDs, invalid automation levels, invalid asset classes, and features that do not apply to the selected asset class are rejected.

## Production readiness

When PostgreSQL is configured, `/ready` requires the entitlement table to exist and report healthy. The primary schema smoke also requires migration 010, the feature-profile table and its index.

Entitlements control product availability; they do not grant data rights. Enabling a licensed-data feature for a tenant does not authorize a vendor call unless the relevant provider is separately configured, licensed, and production-certified for that capability, asset class and market.
