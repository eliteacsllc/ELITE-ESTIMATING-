# Elite Estimating

Unified, multi-domain estimating infrastructure for insurance, repair, restoration, appraisal, fleet, specialty equipment, and property claims.

## Mission

Eliminate estimating fragmentation by providing one standards-first platform for:

- Passenger vehicles
- Commercial vehicles and tractor-trailers
- Heavy equipment, construction equipment, agricultural equipment, and material-handling equipment
- Motorcycles, ATVs, UTVs
- RVs and motorhomes
- Boats and marine assets
- Ambulances and emergency vehicles
- Cranes, industrial machinery, manufacturing equipment, and specialty machinery
- Residential and commercial property
- Contents, catastrophe, restoration, and specialty losses

Elite Estimating is designed as a **data-neutral estimating kernel**. Proprietary third-party datasets are never copied or scraped. Data enters through licensed APIs, OEM feeds, customer-owned data, public/regulatory sources, and standards-compliant connectors.

## Core advantages

1. One estimate model across asset classes.
2. Provider-neutral data federation rather than vendor lock-in.
3. OEM procedures and ADAS/calibration requirements surfaced at estimate-line level.
4. AI-assisted damage recognition with human review, provenance, and confidence scoring.
5. Regional labor, material, parts, tax, currency, and catastrophe pricing.
6. Open interoperability: CIECA BMS/CAPIS adapters, ACORD adapters, JSON/CSV/PDF export, and vendor-specific connectors where licensed.
7. Explainable estimate decisions with source provenance and revision history.
8. Enterprise multi-tenancy, RBAC, audit trails, configurable carrier/shop rules, and approval workflows.
9. Mobile-first inspection and photo capture.
10. Global localization: currency, language, units, tax, jurisdiction, and market pricing.

## Architecture

```text
Inspection / Intake
       |
       v
Asset Identity + Build/Configuration Resolver
       |
       v
Damage Graph ---> OEM / ADAS / Procedure Intelligence
       |                         |
       v                         v
Estimate Kernel <---- Federated Data Gateway ---- Licensed Providers / OEM / Public Data
       |
       +--> Rules + Compliance Engine
       +--> Pricing + Labor Engine
       +--> Parts / Materials Sourcing
       +--> AI Recommendation + Confidence
       +--> Human Review / Approval
       |
       v
Estimate / Supplement / Repair Plan / Settlement Export
```

## Repository status

Foundation initialized. The first production contracts cover domain-neutral estimates, provider adapters, provenance, AI/human decision controls, and reusable super-agent roles.

## Non-negotiable controls

- No unauthorized scraping or redistribution of proprietary databases.
- Every external datum records provider, source ID, retrieval time, region, license class, and confidence.
- AI recommendations cannot silently overwrite human-approved estimate lines.
- Safety-critical repair operations (structural, ADAS, restraint, HV/EV, calibration) require source-backed procedure evidence.
- Tenant data is isolated by design.
- Every estimate mutation is auditable.

## Next build lanes

- API service and persistence
- Identity/VIN/serial/configuration resolution
- Estimate kernel and calculation engine
- OEM/ADAS procedure adapters
- Property sketch and measurement engine
- Photo/vision inspection pipeline
- Parts/labor/material pricing federation
- Carrier/shop rule packs
- CIECA + ACORD interoperability
- Mobile/desktop/web clients
- Enterprise security/compliance
- Automated test, audit, and deployment pipelines


## First-class specialty asset domains

Elite Estimating treats complex assets as governed estimating domains rather than labels on a generic vehicle workflow.

- **Heavy equipment**: serial/configuration, operating hours, attachments, hydraulics, running gear, structure, mobilization, safety, and repair-vs-replace economics.
- **RV / motorhome**: chassis plus coach structure, 12V/120V electrical, LP gas, plumbing, HVAC, appliances, slide-outs, moisture intrusion, and valuation.
- **Marine / boat**: HIN/engine identity, hull/deck/stringer/transom, propulsion, fuel, steering, electrical, navigation, plumbing, rigging, haul-out, trailer, and water-test controls.
- **Industrial machinery**: nameplate/serial identity, hours/cycles/capacity, installation, mechanical and fluid-power systems, PLC/HMI controls, tooling, guarding/LOTO, calibration, rigging, commissioning, downtime evidence, and obsolescence/valuation.

All domains reuse the same estimate, evidence, provenance, tenant, audit, approval, integration, and human-governance contracts. Domain profiles add the asset-specific workflow without fragmenting Claims Management, Damage IQ, Estimatics Library, Elite QA, or EVN.
