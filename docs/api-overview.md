# API and Interchange Overview

## Public service endpoints

- `GET /` — browser estimating workspace.
- `GET /health` — liveness check.
- `GET /ready` — readiness gate; production requires valid auth configuration and healthy durable storage.
- `POST /v1/estimates` — create a tenant-scoped estimate.
- `GET /v1/estimates/{id}` — retrieve a tenant-scoped estimate.
- `PUT /v1/estimates/{id}/lines` — replace current draft/review scope lines and recalculate totals.
- `POST /v1/estimates/{id}/approve` — approve only after audit, human approval, provenance and carrier-rule gates pass.
- `POST /v1/estimates/{id}/void` — void an estimate when caller RBAC permits.

All estimate endpoints require a signed bearer token containing `userId`, `tenantId`, `roles`, and `exp`. Cross-tenant resource access is denied except for the platform-admin role.

## Canonical interchange

`EliteJsonInterchangeAdapter` defines the first canonical loss-estimate envelope (`elite-estimating/v1`). It exists so import/export adapters for CIECA, carrier APIs, property estimating formats and other legitimate integrations can translate into one internal estimate model rather than coupling the core estimator to any proprietary vendor schema.

Do not advertise compatibility with a third-party interchange format until an adapter has been validated against the exact target schema/version and any necessary licensing requirements have been satisfied.

## Provider federation

Provider capabilities are resolved independently of estimate storage. Provider selection may vary by tenant, jurisdiction, asset class, capability and licensing rights without changing the estimate domain model.

## Safety and approval

Safety-critical operations require provenance and procedure evidence. AI-generated lines require confidence metadata and still require human approval before estimate approval. Baseline safety inference raises OEM procedure, scan, calibration, measurement and structural-review requirements for relevant operations; production deployments should supplement these baseline rules with current licensed OEM/provider data.
