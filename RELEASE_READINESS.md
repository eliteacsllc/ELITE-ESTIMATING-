# Release Readiness Gate

This repository is not considered 100% launch-ready until every gate below is verified with repository-local evidence.

## Mandatory gates
- [ ] Usable source code — runnable/buildable product code, lockfiles, and reproducible build instructions exist; no placeholder-only critical paths.
- [ ] Documentation — README, setup/configuration, user/admin/operator docs, API/interface docs where applicable, troubleshooting, and release notes support an independent operator.
- [ ] IP rights — licenses, third-party notices, dataset/model/content rights, generated/copied code provenance, trademarks/assets, and contributor rights are documented; unknown rights block release.
- [ ] Architecture — current component, data-flow, dependency, trust-boundary, integration, and failure-boundary architecture is documented.
- [ ] Tests — repeatable automated/manual tests and release evidence exist, including security, isolation, recovery, and critical-path coverage where applicable.
- [ ] Deployment materials — production/staging definitions, environment contract, secrets handling, migrations, observability, backup/restore, rollback, health checks, and runbooks exist and are validated.
- [ ] Clean ownership — ownership/provenance is clear for code, assets, data, models, dependencies, domains, infrastructure, accounts, and third-party services; no ambiguous or non-transferable critical dependency is cleared.

A checked item must point to real repository evidence or a controlled external record. Any unchecked, unknown, expired, failing, or unverifiable item is a release blocker. Do not claim 100% readiness until all seven gates pass against the exact release commit.
