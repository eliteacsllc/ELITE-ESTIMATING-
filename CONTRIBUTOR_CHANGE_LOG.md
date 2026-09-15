# Contributor Change Log

Purpose: record code changes detected during this ChatGPT working session that were made outside the current active developer pass. This prevents silent overwrite and creates an audit trail for reconciliation.

## 2026-09-10 — concurrent contributor/session detected

Attribution: GitHub commit search did not expose a reliable author identity through the connected API. Do not infer a person. Treat as `concurrent contributor/session` until independently attributed.

### Governed estimate normalization
- `094042f697db2613288761e65b6415bb5a7ed357` — add governed estimate normalization.
- `73f722af4db213f14b5b410d90930e8f05556a2e` — add normalization control tests.
- `b41921ee6ccd17389414dacd3d33090fbbaca157` — export estimate normalization.
- `8133e0c568de3600a86c7144e5a724827e445ced` — normalize governed estimate proposals.
- `bc5d083eeb11a0bcfe6f30fc81ec71860e3aa6d9` — promote governed estimate normalization.

Observed functional impact:
- Provider-neutral estimate-line normalization.
- Provenance validation and de-duplication.
- Cross-currency blocking.
- Safety-critical procedure-reference requirement.
- Confidence/review flags.
- Human approval remains mandatory; imported approval state is not trusted.

Developer handling:
- Preserve.
- Re-read current head before any future estimating change.
- Do not overwrite this functionality with stale pre-2026-09-10 copies.
- Re-run canonical test/release gates before modifying or promoting related estimating logic.
