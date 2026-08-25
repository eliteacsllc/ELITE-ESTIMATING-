# Governed Estimating Decisions

Advanced estimate recommendations are optional tenant features. They are not globally available merely because the calculation engine exists.

## Feature gates

- Parts optimization requires `parts_optimizer`.
- Repair-vs-replace requires `repair_replace` (which resolves its `estimate_audit` dependency).
- Total-loss analysis requires `total_loss` (which resolves `market_comps`).

The feature profile is resolved for the estimate's asset class. A disabled feature returns `feature_not_entitled:<feature>` and no decision is persisted.

## Estimate binding

Every decision is bound to:

- tenant;
- estimate ID;
- exact estimate revision used by the calculation;
- decision type;
- canonical SHA-256 of the request input;
- actor and timestamp;
- persisted calculation result.

The calculation currency must match the estimate currency. This prevents an advanced recommendation from being silently attached to an unrelated estimate version or monetary basis.

## Natural retry idempotency

The unique decision identity is:

`tenant + estimate + estimate revision + decision type + input SHA-256`

An exact retry returns the original decision record (`replayed=true`) instead of creating duplicate decision/audit records. A materially changed input produces a different hash and a new decision.

## HTTP API

- `GET /v1/estimates/:id/decisions`
- `POST /v1/estimates/:id/decisions/parts`
- `POST /v1/estimates/:id/decisions/repair-replace`
- `POST /v1/estimates/:id/decisions/total-loss`

First creation returns HTTP 201. Natural replay returns HTTP 200 with `idempotency-replayed: true`.

## Safety and provenance

The underlying engines preserve their existing safeguards:

- Parts optimization rejects candidates that fail configured OEM/safety/carrier constraints and requires source provenance.
- Repair-vs-replace treats safety/quality feasibility as hard decision inputs rather than price-only scoring.
- Total-loss valuation uses provenance-backed comparables and will not make a jurisdictional determination without an explicit jurisdiction/policy reference; it returns `manual_review` instead.

A decision is a recommendation/evidence artifact. It does not silently approve estimate lines or bypass human approval, OEM procedure gates, MOTOR/RACED/DEG/I-CAR rules, carrier controls or domain-workflow approval gates.

## Production durability

Migration 011 creates `estimate_decision_records` with tenant isolation, estimate foreign keys and an idempotent replay index. PostgreSQL `/ready` requires decision storage health, schema smoke validates the table/indexes and orphan integrity, and production shutdown closes the decision connection pool.
