# Repair Plan and Domain Workflow API

Elite Estimating exposes estimate-scoped workflow APIs for repair planning and domain-specific operating checklists. These endpoints are authenticated and tenant-scoped through the same RBAC boundary as estimate reads and updates.

## Repair plan

- `GET /v1/estimates/:id/repair-plan` returns `{ repairPlan }`, where the value is the stored checklist or `null`.
- `PUT /v1/estimates/:id/repair-plan` replaces the repair-planning checklist after strict runtime validation.

Every required checklist field must be a boolean. `notes`, when supplied, must be a string. Partial or malformed payloads are rejected before persistence.

Repair planning is a safety/approval control, not merely a premium entitlement. If estimate content triggers MOTOR/RACED, structural, ADAS, diagnostic, EV/HV, or other repair-plan requirements, the approval gate remains enforceable even when unrelated premium modules are disabled.

## Domain workflow

- `GET /v1/estimates/:id/domain-workflow` returns `{ domainWorkflow }`, or `null` before initialization.
- `POST /v1/estimates/:id/domain-workflow` initializes the workflow from Elite's server-side domain registry. Repeated initialization is safe and returns the existing workflow.
- `PATCH /v1/estimates/:id/domain-workflow/steps` updates one workflow step. `POST` is also accepted for clients that cannot issue PATCH.

The client may submit:

- `stepId`
- `status`: `pending`, `complete`, or `not_applicable`
- optional `evidenceRefs`
- optional `note`

The client does **not** control the workflow domain, required-step definitions, checklist reasons, `completedBy`, or completion time. When a step is completed or marked not applicable, Elite binds completion identity to the authenticated principal and generates the completion timestamp on the server. Duplicate evidence references are normalized.

Required steps marked `not_applicable` still require a reason/note. Domain workflow completeness remains part of estimate approval when a domain workflow exists.

## Security and integrity properties

- tenant isolation is inherited from estimate lookup and RBAC;
- approved or void estimates are locked from workflow mutation;
- malformed repair-plan and workflow-step payloads are rejected before storage;
- domain/checklist generation comes from the authoritative domain registry, not client-authored workflow state;
- audit and lifecycle events are emitted for initialization, repair-plan updates, and step updates;
- the production HTTP smoke proves that a forged `completedBy`/`completedAt` request cannot override server-owned identity or time.
