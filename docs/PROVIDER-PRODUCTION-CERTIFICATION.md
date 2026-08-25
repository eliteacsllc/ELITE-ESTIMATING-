# Production Data / Provider Certification SOP

No provider is production-enabled because an adapter compiles or a commercial agreement exists. Elite requires both lawful data rights and technical production certification.

## Required evidence

For each provider record:

1. Executed agreement/license reference and approval.
2. Explicit production authorization.
3. Credential provisioning reference; never store credential values in the certification manifest.
4. Credential scope: platform or tenant. Tenant-scoped providers must certify with tenant scope.
5. Certified regions and asset classes.
6. Certified capabilities.
7. Any capabilities approved as authoritative for safety decisions.
8. Support/escalation reference.
9. Approved retention/usage terms.
10. Mandatory source provenance.

## Live certification

Every certified capability requires at least one live sample query against the adapter. Certification executes the normal provider conformance checks and additionally verifies:

- descriptor identity matches the production manifest;
- region, asset and capability scope are not broader than the adapter declares;
- health succeeds;
- sample query is supported;
- returned records carry valid provenance and lawful license class;
- tenant credential requirements are respected;
- every production capability is exercised;
- certification produces an immutable SHA-256 descriptor hash.

A blocker makes the certification RED.

## Launch binding

The launch manifest contains both `dataRights` and `providerCertifications`. Every approved data-rights provider must have a GREEN certification record whose capability and region scope covers the approved data-rights scope. The certification must include an evidence reference and valid descriptor hash.

This prevents an agreement-only provider, stale adapter, region mismatch or partially tested capability set from being treated as production ready.

## Vendor adapter policy

Do not invent vendor endpoints, credentials, schemas or licensing permissions. Build vendor-neutral domain logic and governed adapter ports first. A vendor-specific adapter may be activated only after licensed API documentation and credentials are available and its production certification is GREEN.

This policy applies to MOTOR/RACED data feeds, OEM procedure publishers, parts networks, ADAS/diagnostics sources, valuation and market-comps providers, salvage sources, property pricing, weather/catastrophe, code/regulation and future providers.
