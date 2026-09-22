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


## Concurrent estimator workspace contribution — PR #112

- Attribution: shared `eliteacsllc` GitHub account; individual/session identity not independently established.
- Original PR/head: #112, `feat/estimating-domain-workflow-ux`, `440006386fc0a606ccbaffb4b5de2ccd0b42b70e`.
- Original files: `src/web/assets.ts` (blob `d31d69cf953f9cdb3c1c645caa878124aa55f863`) and `src/web/assets.test.ts` (blob `76b12f83eea4e95406f83d45a698f70701fce2c0`).
- Functional scope: first-class specialty asset navigation, load-existing-estimate, server-backed domain checklist, human-reviewed scope editor, unsaved-change protection, explicit procedure evidence, accessible workflow status and browser-script regression tests.
- Reconciliation: both exact contributor blobs were preserved on canonical `lab` in merge `0c59ec0275640ae04a32a11de716f2e2398d84c0`; main's other files and independent lab governance/checklist security changes were retained. The original PR remains open for provenance pending canonical release validation.
- Security/quality: checklist status and mandatory evidence now validated server-side separately; no hosted-pass or deployment claim is made before exact-head checks pass.

### Follow-up UI correction

The contributor's UI and test blobs were first preserved exactly in merge `0c59ec0275640ae04a32a11de716f2e2398d84c0`. A subsequent, separately committed UI correction (`b1eeb359610dcd2e3d2fdc3451f2f30ed35cbc97`) changed only the default rail/agent status labels so an empty workspace no longer claims work is complete or unverified agents are active; the original contributor blobs remain available in PR #112 and merge history. Regression test added in `62b52d3e4726d046f02adb1bdcfc83a037fdcef9`.
