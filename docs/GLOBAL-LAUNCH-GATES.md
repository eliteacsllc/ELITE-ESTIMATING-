# Global launch gates

Elite Estimating is not considered production-ready merely because code builds. Every launch market and asset class must pass these gates.

## Product
- End-to-end estimate creation, revision, supplement and export.
- Passenger auto, commercial/heavy, specialty, marine/RV and property workflows validated separately.
- Offline-tolerant mobile inspection capture.
- Accessible web interface and keyboard-complete estimate authoring.
- Clear basic mode for independents and enterprise mode for carriers/MSOs/IAs.

## Data
- Licensed or otherwise lawful source for each required data category.
- Provider failover where commercially practical.
- Provenance stored on every imported price/procedure/configuration datum.
- Regional freshness SLA and stale-data warnings.
- Data-retention and deletion rules documented.

## Safety / estimate quality
- OEM/procedure evidence for structural, restraint, ADAS, EV/HV and other safety-critical operations.
- Included/overlap/dependency rules tested.
- Estimate math property tested across currencies and taxes.
- Human review thresholds configured for low-confidence AI.
- Supplement/revision diff audit trail immutable.

## Interoperability
- CIECA BMS/CAPIS integration tests for collision workflows.
- ACORD-compatible claims boundary where licensed/appropriate.
- JSON API and PDF output contract tests.
- Vendor adapters isolated from the canonical model.

## Enterprise security
- SSO/OIDC/SAML capability.
- MFA support.
- RBAC/ABAC and tenant isolation tests.
- Encryption in transit and at rest.
- Secret rotation.
- Full audit logging.
- Backup/restore and disaster-recovery test.
- Vulnerability/dependency scanning.
- Rate limits, abuse controls and WAF policy.

## Privacy / regional compliance
- Data processing inventory by market.
- Privacy notices and DPA templates.
- Configurable data residency where required.
- DSAR/export/deletion workflows where applicable.
- Subprocessor inventory.

## Reliability
- Multi-zone production design where available.
- Health/readiness endpoints.
- Error budget and SLOs.
- Queue retry/dead-letter behavior.
- Provider timeout/circuit-breaker behavior.
- Load, soak, failover and chaos tests.

## Commercial
- Transparent pricing by user/estimate/API usage.
- No surprise provider-data pass-through charges.
- Carrier/MSO enterprise contracts.
- Free/low-cost entry path for independents where economics allow.
- Usage metering and billing reconciliation tested.

## Executable certification

1. Copy `launch/launch-manifest.example.json` to a market-specific evidence file.
2. Replace placeholders only with real evidence references and executed/approved records.
3. Configure production environment variables without committing credentials.
4. Build the project, then run `npm run launch:check -- <manifest.json>`.
5. A zero exit code means the machine-enforced gates represented by the manifest and runtime configuration are GREEN. It does not waive unmodeled legal, contractual, operational, or regulatory obligations.

The shipped example is intentionally RED: approvals are false and recovery targets are zero. CI tests that it cannot accidentally certify production.

## Launch decision

A market is GREEN only when all critical gates are evidenced. Missing licensed data, security controls, or safety procedure coverage is a launch blocker—not a warning.
