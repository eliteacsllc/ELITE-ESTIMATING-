# Free-first operating mode

Elite Estimating is designed so no single commercial estimating platform is an architectural dependency. The canonical estimate, evidence graph, agent mesh, rules, approvals, interchange, and audit trail remain owned by Elite. Commercial data providers are optional adapters.

## Source order

When multiple lawful sources can satisfy the same need, the preferred operating order is:

1. official public data;
2. customer-provided or customer-owned evidence;
3. Elite-owned data and derived knowledge that is lawful to retain and reuse;
4. licensed commercial data.

`ProviderRegistry.routeFreeFirst()` applies this source-class preference while retaining capability, asset-class, region, enabled-state, and per-class priority checks.

This preference is not a license to use a weaker source for a safety-critical decision. The evidence and safety gates remain controlling.

## Included public adapters

### NHTSA vPIC

`NhtsaVpicProvider` supports `asset_identity` and `build_configuration` for eligible US road vehicles with a 17-character VIN. It uses the official NHTSA vPIC API and does not require a commercial estimating subscription or provider credential.

### NHTSA Recalls

`NhtsaRecallsProvider` supports `safety_recalls` for eligible identified road vehicles. Recall records are evidence context. They do not replace the complete OEM collision repair procedure for the repair being performed.

### OpenFEMA

`OpenFemaDisasterProvider` supports `weather_catastrophe` for US residential and commercial property estimates when a state can be resolved. It provides federal disaster-declaration context and does not replace loss-specific causation evidence or detailed weather observations.

### National Weather Service

`NwsAlertsProvider` uses the official `api.weather.gov` alerts service with an application User-Agent and no commercial API key. It supplies active watch/warning/advisory context for state-scoped supported property and road-vehicle work. NWS alert context does not by itself prove that a particular item was damaged by the reported event.

Additional public adapters can be added through the same `EstimatingDataProvider` contract. Candidate free sources include official jurisdictional code sources, USGS event/hazard services, and other government datasets when their terms, scope, and technical reliability are approved.

## Customer-owned evidence adapter

`CustomerEvidenceProvider` and `createUniversalCustomerEvidenceProvider()` let a tenant use authorized evidence it already owns or is permitted to use, including:

- OEM procedures or manufacturer documents supplied by the customer;
- labor references and estimating guides the customer is authorized to use;
- dealer, supplier, recycler, remanufacturer, and aftermarket quotes;
- parts invoices and historical authorized invoices;
- diagnostic scans and calibration reports;
- market comparable listings and dealer quotes;
- salvage bids;
- property contractor and supplier quotes;
- carrier guidelines and assignment documents;
- official code/regulation documents;
- photos, measurements, inspection records, and other claim evidence.

Every record retains `customer_provided` provenance and a source identifier. Customer evidence does not become globally reusable merely because it enters the platform; tenant ownership, license scope, retention, and privacy controls still apply.

## Capability fallback policy

`FREE_FIRST_CAPABILITY_POLICY` defines a non-commercial fallback path for every provider capability. No capability has `paidProviderRequired=true`.

A missing paid feed therefore produces one of three states:

- `free_covered` — an approved public/customer/owned provider covers the capability;
- `customer_evidence_needed` — the estimator can continue after supplying documented evidence or a supported manual basis;
- `authoritative_evidence_needed` — the workflow must stop at the relevant safety/compliance gate until an authoritative source is supplied.

The final state is intentional. Elite must remain useful without a commercial provider, but it must not invent OEM repair procedures, ADAS requirements, codes, or other safety/legal facts.

## Source orchestration

`buildFreeFirstSourcePlan()` harmonizes feature requirements and automatically useful public context into a single estimate-scoped sourcing plan. It returns:

- provider capabilities required by enabled optional features;
- automatic public intelligence such as NHTSA recall context for supported road vehicles and catastrophe context for property;
- available free provider coverage;
- missing public-query inputs such as VIN, year/make/model, or state jurisdiction;
- capabilities that can be satisfied through documented customer evidence;
- capabilities that require authoritative evidence before safety/compliance approval;
- an explicit guarantee that no paid provider is architecturally required.

The input-gap output prevents the UI or an agent from calling a capability “ready” merely because an adapter exists. For example, NHTSA recall coverage still requires year/make/model, and automatic state-scoped NWS/OpenFEMA context requires a jurisdiction.

## Production certification without commercial credentials

Provider descriptors support `credentialMode: none | platform | tenant`.

Official public providers can use `credentialMode: none`. Their production manifest must still prove:

- a reviewed public-source/data-rights or terms reference;
- explicit production authorization by the operator;
- approved retention/use treatment;
- region, asset, and capability scope;
- live sample-query conformance;
- required provenance;
- an official source/support reference.

`publicProviderProductionManifest()` prebuilds manifests for NHTSA vPIC, NHTSA Recalls, OpenFEMA, and NWS. The human approval booleans are deliberately not auto-approved by code.

Licensed providers continue to require their actual platform/tenant credentials and applicable agreement evidence.

## Agent-mesh relationship

Free-first sourcing does not bypass the agent mesh. Evidence from public, customer, owned, and licensed sources flows through the same orchestration, harmonization, redundancy, security/governance, performance-routing, and quality-verification layers.

For important and safety-critical decisions, independent agents can challenge one another, evidence/source-family diversity is measured, failed or low-trust agents can be isolated, and final estimate mutation remains human-controlled.

The source plan can be consumed before the mesh assigns provider-dependent work so agents know whether to query a public source, request customer evidence, use an approved owned source, fall back to an optional licensed provider, or stop at an authoritative-evidence gate.

## What this replaces and what it does not

This architecture can remove the need to depend on a commercial platform for the application itself, VIN decoding, public recall context, public catastrophe/weather-alert context, evidence ingestion, estimate construction, rules orchestration, AI assistance, auditing, supplements, valuation workflows, and provider federation.

It does **not** claim that public APIs contain every proprietary labor time, every OEM collision repair procedure, every parts catalog, or every carrier-specific rule. Where those facts are not lawfully available for free, Elite uses customer-authorized evidence, documented estimator input, an optional licensed adapter, or an authoritative-evidence gate.

That separation is a competitive feature: the customer can operate the platform without vendor lock-in and add paid data only where its incremental value justifies the cost.
