# Elite Estimating SOP — MOTOR / RACED / DEG / I-CAR

This SOP operationalizes public, licensed, and customer-provided estimating references without reproducing proprietary databases or repair manuals.

## Source precedence

1. Current OEM repair procedure, position statement, safety requirement, or manufacturer restriction.
2. Vehicle-specific estimating-system labor note or footnote.
3. Current MOTOR Guide to Estimating or MOTOR RACED/Recycled Assemblies Guide, according to the selected part basis.
4. DEG clarification, inquiry resolution, or estimating tip that applies to the provider/operation/model year.
5. Documented estimator on-the-spot judgment for conditions the database does not model.
6. Carrier/customer rules only after the factual repair/safety scope is established. Carrier rules cannot suppress OEM or safety requirements.

## Damage analysis and blueprinting

Before final estimate approval:

- identify the vehicle accurately and confirm configuration/options;
- photograph and document direct, indirect, hidden, prior, and unrelated damage;
- perform sufficient teardown/disassembly to expose loss-related damage;
- identify structural, restraint, ADAS, diagnostic, EV/high-voltage, glass, mechanical, corrosion-protection, and refinish implications;
- identify every required part, clip, fastener, label, one-time-use item, material, sublet operation, and special tool/equipment requirement;
- retrieve current OEM repair information for affected systems/components;
- confirm technician capability/certification and equipment availability;
- resolve pre-repair scan, calibration and post-repair scan requirements;
- establish final QC, functional validation and test-drive requirements where applicable.

## MOTOR Guide rules

- Treat estimated work times as a guide, not as an automatic repair prescription.
- Keep the source revision and vehicle-specific footnote/labor-note references with the estimate line.
- When an operation is included in another selected operation, do not charge it twice.
- When an operation is explicitly not included, evaluate whether the actual repair requires it and add a separate sourced/manual line when justified.
- A blank database labor field must not be interpreted as zero work. It may require estimator evaluation and a documented manual labor value.
- Preserve the original database labor value whenever labor is overridden.
- Require an override reason for changed labor, changed descriptions, or manual entries.
- Safety-critical work requires authoritative OEM procedure evidence in addition to estimating-guide data.

## RACED / recycled assembly rules

- Use the recycled-assembly estimating basis for recycled/LKQ assemblies; do not apply new-OEM replacement assumptions to recycled assemblies.
- Record what components are supplied as part of the recycled assembly.
- Apply RACED included/not-included labor logic and controlling footnotes for that assembly.
- Evaluate additional preparation, transfer, cleanup, damage correction, corrosion protection, refinishing, measuring, diagnostics and calibration operations based on the actual assembly/vehicle condition and governing source.
- Record supplier cost/markup and estimator labor/refinish overrides separately from the source database basis.

## DEG clarification workflow

- Store the DEG source URL, provider, inquiry/tip identifier, publication/effective date when known, affected operation/system, and a concise derived rule summary.
- Do not bulk-copy DEG articles or proprietary P-page tables into the repository.
- When a DEG clarification conflicts with stale local logic, flag the local rule for review rather than silently changing historical estimates.
- Model-year-specific changes must include an effective-model-year gate.
- Query/display the applicable DEG reference during estimate review so an estimator can verify the current source.

## Estimate review sequence

1. Validate estimate/vehicle identity.
2. Complete blueprinting and damage discovery.
3. Retrieve OEM procedures and safety requirements.
4. Select part basis: new OEM, recycled assembly, aftermarket, repair-existing, or other supported source.
5. Apply database work time and labor notes.
6. Apply included/not-included relationships and dependency logic.
7. Apply vehicle-specific footnotes before generic Guide assumptions.
8. Surface applicable DEG clarifications.
9. Add required not-included/manual operations with documented basis.
10. Validate structural/ADAS/EV-HV/diagnostic/calibration scope.
11. Validate parts/materials/sublet/equipment/one-time-use items.
12. Run duplicate/inclusion and safety audits.
13. Require human approval for AI suggestions and estimator overrides.
14. Apply carrier rules only after repair scope is technically established.
15. Approve estimate, preserve provenance, and send lifecycle event.
16. Re-run the same logic on every supplement/revision.

## Data/licensing boundary

Elite Estimating may store normalized rule metadata, source identifiers, provenance, customer-owned data, licensed provider responses, and concise derived rule summaries. It must not scrape/copy proprietary MOTOR, CCC, OEM, Audatex, Mitchell, I-CAR training, or DEG copyrighted content into an unlicensed substitute database.
