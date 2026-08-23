# Competitive benchmark and product requirements

This document captures the first global benchmark wave and converts competitor strengths into implementation requirements without copying proprietary data or software.

## Collision / automotive

### CCC ONE / CCC Insurance
Strengths to match or exceed:
- AI-built line-level estimates
- Parts sourcing and supplier connectivity
- Repairer/insurer workflow network
- Build-sheet/vehicle configuration resolution
- Diagnostics and ADAS document integration
- Mobile field appraisal

Elite response:
- Keep AI provider-neutral.
- Accept multiple vision engines and multiple data providers.
- Attach diagnostics, calibration evidence, procedures, invoices, and photos directly to estimate lines.
- Make every recommendation explainable and portable.

### Mitchell Cloud Estimating
Strengths to match or exceed:
- Web estimating on any device
- Integrated OEM repair procedures
- AI damage analysis mapped into estimate lines
- BMS interoperability
- TruckMax and specialty vehicle support
- Carrier estimate profiles/rules

Elite response:
- One asset model for passenger, truck, specialty, property, and equipment.
- Rules are tenant-owned policy packs, separated from safety/OEM facts.
- Multiple interchange standards and vendor adapters.

### Solera Audatex / Qapter
Strengths to match or exceed:
- Global deployment and localization
- AI photo estimating
- VIN/build data
- Triage and valuation
- Cross-network dispatch
- Large international data footprint

Elite response:
- Global locale/tax/unit/currency model from day one.
- Provider federation instead of one proprietary source.
- Dispatch is estimating-system-neutral.

### Web-Est
Strengths to preserve:
- Simplicity
- Browser delivery
- Lower-cost access for independent shops/appraisers

Elite response:
- A fast basic mode for one-off estimates plus enterprise mode for carriers/MSOs.

### AdjustRite
Strengths to match or exceed:
- Heavy truck/equipment focus
- Procedural logic (overlap, included operations, additional operations)
- Custom databases
- Mobile/web access

Elite response:
- Procedural dependency graph applicable to every asset type.
- Tenant-owned custom catalogs layered over licensed reference data.

### DAT SilverDAT / GT Motive / regional estimatics systems
Strengths to match or exceed:
- Regional vehicle identification, valuation, parts, labor, graphical selection, and insurer workflows.

Elite response:
- Region-aware adapters and a canonical internal estimate model so a carrier can use the same workflow across markets.

## OEM / repair intelligence

### MOTOR
Strengths:
- OEM-derived service procedures
- Labor times
- Parts and specifications
- API delivery
- Medium/heavy vehicle cross-reference data

Elite response:
- Treat OEM/repair intelligence as licensed provider modules with immutable provenance.

### ALLDATA
Strengths:
- Factory-direct collision and mechanical repair information
- Manufacturer position statements
- ADAS reference
- Estimate-line-linked repair planning

Elite response:
- Procedure evidence panel attached to every safety-critical line and available throughout teardown/repair/QC.

### Repairify / Opus IVS / diagnostic ecosystems
Strengths:
- Scan/calibration workflows
- ADAS requirement identification
- Diagnostic evidence

Elite response:
- Standard diagnostics/calibration connector contract so any qualified provider can plug in.

## Property / restoration

### Xactimate
Strengths to match or exceed:
- Deep line-item pricing
- Labor/material/equipment components
- Monthly regional pricing
- Sketch/graphical estimating
- depreciation
- macros
- code upgrades
- audit/inspection
- cloud/mobile/desktop continuity
- multilingual reports

Elite response:
- Universal assemblies + quantity engine.
- Regional price federation with source comparison and confidence.
- 2D/3D/AR measurement input contract.
- Explicit RCV/ACV/depreciation/tax/code logic.
- Shared evidence/provenance model with vehicle estimates.

### Symbility / Cotality, HOVER, Encircle, magicplan, Simsol, Snapsheet and others
Requirements:
- Photo-first capture
- Fast structure measurement
- restoration workflow
- collaboration
- audit trails
- estimate comparison
- remote desk review

Elite response:
- Modular measurement/vision adapters feeding one property damage graph.

## Platform requirements derived from the benchmark

1. Canonical estimate model independent of provider.
2. Canonical damage graph independent of asset class.
3. Provider federation with licensing controls and provenance.
4. Interchange gateway (CIECA BMS/CAPIS, ACORD, JSON, CSV, PDF and licensed vendor adapters).
5. AI engine marketplace with confidence and human approval controls.
6. Safety procedure engine: OEM, ADAS, restraints, structural, EV/HV, scan/calibration.
7. Dependency/overlap engine for included/not-included operations.
8. Regional price intelligence across labor, parts, materials, equipment and catastrophe conditions.
9. Asset configuration engine: VIN/serial/build sheet/equipment/property attributes.
10. Parts and material sourcing network.
11. Estimate audit/scrub engine.
12. Supplement and revision comparison engine.
13. Carrier/shop/IA rule packs with clear separation between contractual rules and factual repair requirements.
14. Total-loss/valuation adapter layer.
15. Mobile guided inspection and evidence capture.
16. Web/desktop/mobile parity.
17. Multi-language, currency, tax, units and jurisdiction support.
18. Enterprise SSO/RBAC/audit/multi-tenancy/data residency controls.
19. API-first architecture for carrier, claims platform, shop management and vendor integrations.
20. Human-readable and machine-readable explanation for every estimate decision.
