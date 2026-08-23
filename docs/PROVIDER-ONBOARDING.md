# Licensed Data Provider Onboarding

Elite Estimating integrates external estimating data only through the provider-neutral connector contract in `src/connectors/contracts.ts`. Provider-specific code must not bypass the federated gateway, provenance model, circuit breaker, tenant isolation, or launch certification gates.

## Required adapter behavior

Every provider adapter must implement `EstimatingDataProvider` and declare a stable descriptor:

- unique stable `id`;
- human-readable `name`;
- exact supported capabilities;
- exact supported regions;
- whether a license is required;
- whether credentials are tenant-scoped.

Capabilities must map to the existing Elite capability vocabulary such as asset/build identity, parts, labor, market pricing, OEM procedures, ADAS, diagnostics, valuation, property pricing, catastrophe/weather, or codes/regulations. Add a new platform capability only when the existing vocabulary cannot faithfully represent the provider contract.

## Credentials

Provider credentials must be injected at runtime from a secret store. Do not commit tokens, API keys, passwords, certificates, or vendor credentials. If the provider contract requires tenant-specific credentials, the adapter must not reuse one tenant's secret for another tenant.

## Provenance

Every returned record must contain `SourceProvenance` with:

- provider identity;
- retrieval timestamp;
- correct license class (`owned`, `licensed`, `public`, or `customer_provided`);
- source identifier when supplied by the upstream provider;
- region when meaningful;
- bounded confidence when the provider exposes or Elite computes a confidence value.

A provider that requires a commercial license must not label its returned records `public`.

## Conformance certification

Before enabling a provider, run it through `certifyProvider()` from `src/connectors/conformance.ts` using a real or vendor-approved sandbox query for one of its declared capabilities and regions.

Certification blocks on:

- invalid descriptor identity;
- missing/duplicate capabilities or regions;
- unsupported certification sample;
- unhealthy/throwing health checks;
- invalid provenance timestamp/license class;
- license-required data mislabeled public;
- invalid confidence values;
- missing tenant identity for tenant-scoped credential providers;
- query exceptions.

Warnings still require review but do not automatically block certification.

## Launch evidence

Passing adapter conformance is necessary but not sufficient for market launch. The applicable production launch manifest must also include a real, approved data-rights record naming the provider, covered capabilities, covered regions, and agreement reference. Safety-critical sources must additionally be represented in approved structural/restraint/ADAS/EV-HV/property-code safety coverage as applicable.

## Recommended onboarding sequence

1. Execute the commercial/data-use agreement and determine licensed capabilities/regions.
2. Obtain sandbox credentials and API documentation from the provider.
3. Implement the provider adapter against `EstimatingDataProvider`.
4. Add mock/unit tests for normalization and error handling.
5. Run `certifyProvider()` against a vendor-approved sandbox/sample query.
6. Verify provider circuit-breaker behavior and degraded-mode behavior.
7. Perform tenant-isolation testing if credentials are tenant-scoped.
8. Add the real agreement reference to the launch manifest for the intended market.
9. Complete safety-source review for safety-critical data.
10. Enable the provider only after the normal CI/release gates remain green.

Do not scrape or reverse-engineer proprietary estimating databases as a substitute for a lawful provider agreement or supported integration path.
