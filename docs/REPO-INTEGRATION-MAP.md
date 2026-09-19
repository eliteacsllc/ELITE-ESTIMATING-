# Elite ecosystem integration map

The Elite Estimating repository remains standalone, but it should integrate with adjacent Elite repositories through explicit APIs/events rather than copy/paste coupling.

## CLAIMS-MANAGEMENT-
Use for:
- claim/assignment intake
- carrier, IA, contractor and reviewer workflows
- status, notes and document exchange
- estimate/supplement approval lifecycle
- dispatch and SLA tracking

Boundary: Claims Management owns the claim workflow, authoritative inspection evidence and routing; Elite Estimating owns estimate calculations, estimate-specific evidence/provenance, procedures, pricing and revisions. Claims sends `inspection.ready_for_estimating` only after authorized review.

## Elite Damage IQ + Claims Management Mobile
Use for:
- guided field inspection and camera/photo-library capture inside Claims Management Mobile
- governed photo/video/document evidence
- component/area labeling and damage findings
- inspection completeness, confidence and provenance
- human-correctable physical-AI findings

Boundary: Claims Management owns the authoritative claim, assignment, evidence record and routing. Damage IQ is the independently deployable perception/inspection service embedded into the mobile experience. Elite Estimating owns estimate authoring, calculations, revisions and estimate-specific evidence linkage; it consumes only Claims-authorized inspection packages.

## echelon-ai-os
Use for:
- orchestration patterns
- agent routing
- authorization policies
- observability and audit patterns

Boundary: Elite Estimating has domain-specific agents; Echelon may orchestrate cross-product business workflows but may not bypass estimating safety or evidence gates.

## elite-developers-playground-
Use for:
- automated build/test/security checks
- preview/smoke tests
- regression and repair loops
- compatibility testing for web/mobile/desktop clients

## elite-hosting-
Use for:
- deployment and hosting integration after its production readiness is verified
- secrets/environment management abstractions
- observability hooks

## eliteacsllc.com
Use for:
- public estimating intake/quote entry points
- contractor/appraiser workflows where appropriate
- customer-facing estimate status and document access

Do not put the estimating engine directly in the marketing site. Integrate through authenticated APIs.

## Integration principles

- API/event contracts, not shared database tables.
- Tenant IDs and authorization context on every cross-repo request.
- Idempotency keys for claim/estimate writes.
- Signed webhooks/events.
- No raw provider credentials crossing service boundaries.
- Estimate calculation remains deterministic and independently auditable.
