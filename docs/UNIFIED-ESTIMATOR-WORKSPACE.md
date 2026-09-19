# Unified Estimator Workspace

This feature exposes Elite Estimating's existing engines through one loss-centric workspace.

## Experience contract

The primary workflow is:

Assignment -> Capture -> Understand -> Repair Plan -> Verify -> Finalize

The UI must avoid forcing users to re-enter data or navigate between disconnected tools. VIN/build data, photos, procedures, parts, labor, valuations, supplements, and QA findings follow the loss context.

## Three-pane workspace

1. **Loss context** — vehicle/property, impact zones, evidence, assignment context.
2. **Estimate** — high-speed line editing, repair plan, revision comparison.
3. **Intelligence** — OEM/procedure requirements, pricing, evidence, AI recommendations, confidence, and source provenance.

## Governance

- AI suggestions never silently overwrite human-approved lines.
- Safety-critical operations require evidence-backed human review.
- External provider data remains licensed/provider-neutral.
- Release is blocked when completeness gates contain blockers.
- All estimate mutations remain auditable.

## Differentiators

- Continuous completeness scoring instead of end-of-file QA only.
- Damage -> component -> operation -> procedure -> calibration/evidence repair graph.
- Live total-loss risk including predicted supplement exposure.
- Estimate/supplement delta normalization.
- Audience-aware reporting.
- Guided, professional, field, and AI-assisted modes.
- Standalone-first integration with Claims Management, Damage IQ, EVN, and Estimatics Library.
