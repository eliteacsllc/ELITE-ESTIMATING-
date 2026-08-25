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

Every certified capability requires at least one live sample query against the adapter. Certification executes the normal provider conformance checks and additionally verifies descriptor identity, region/asset/capability scope, health, sample support, provenance/license class, tenant credential scope, complete capability sampling and an immutable descriptor SHA-256.

A blocker makes the certification RED.

## Portfolio certification

Individual GREEN providers are not sufficient. Elite also evaluates the combined provider portfolio against each launch domain profile.

Every launched asset class declares its optional `enabledFeatures` and `automationLevel`. The platform planner derives the exact provider capabilities created by those choices. Launch then verifies that at least one GREEN provider certification covers each required capability for the selected asset class and launch market.

Examples:

- Manual collision can launch without premium VIN/OEM/MOTOR/ADAS modules when those features are disabled.
- Enabling `oem_procedures` creates an `oem_procedures` provider requirement for that vehicle profile.
- Enabling `motor_raced` creates certified labor-time coverage.
- Enabling `adas_diagnostics` requires both ADAS requirement and diagnostics coverage, plus its OEM-procedure dependency.
- Property pricing/code modules can be enabled independently from collision data providers.

This design keeps advanced capabilities optional while preventing an enabled feature from silently operating without its required production data.

## Launch binding

The launch manifest contains `domainProfiles`, `dataRights` and `providerCertifications`. Every approved data-rights provider needs GREEN certification evidence. Every enabled domain-profile capability must also be covered by the certified provider portfolio for that asset and market.

This prevents an agreement-only provider, stale adapter, region mismatch, wrong asset scope, partially tested capability set or cross-provider portfolio gap from being treated as production ready.

## Vendor adapter policy

Do not invent vendor endpoints, credentials, schemas or licensing permissions. Build vendor-neutral domain logic and governed adapter ports first. A vendor-specific adapter may be activated only after licensed API documentation and credentials are available and its production certification is GREEN.

This applies to MOTOR/RACED data feeds, OEM procedure publishers, parts networks, ADAS/diagnostics sources, valuation and market-comps providers, salvage sources, property pricing, weather/catastrophe, code/regulation and future providers.
