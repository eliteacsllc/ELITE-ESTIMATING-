#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-eliteacsllc/ELITE-ESTIMATING-}"
BRANCH="${2:-main}"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) is required." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: Authenticate first with: gh auth login" >&2
  exit 1
fi

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

if ! gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPO}/branches/${BRANCH}/protection" > "$TMP"; then
  echo "ERROR: Could not read branch protection for ${REPO}:${BRANCH}. Protection may be disabled or your token may lack admin access." >&2
  exit 1
fi

node - "$TMP" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const protection = JSON.parse(fs.readFileSync(path, 'utf8'));
const failures = [];
const required = ['core', 'analyze-javascript-typescript', 'evidence'];
const contexts = new Set(protection.required_status_checks?.contexts ?? []);
for (const context of required) {
  if (!contexts.has(context)) failures.push(`missing required status check: ${context}`);
}
if (protection.required_status_checks?.strict !== true) failures.push('required status checks are not strict/up-to-date');
if (protection.enforce_admins?.enabled !== true) failures.push('administrator enforcement is disabled');
if (!protection.required_pull_request_reviews) failures.push('pull-request review protection is disabled');
if (protection.required_conversation_resolution?.enabled !== true) failures.push('conversation resolution is not required');
if (protection.allow_force_pushes?.enabled === true) failures.push('force pushes are allowed');
if (protection.allow_deletions?.enabled === true) failures.push('branch deletion is allowed');
if (failures.length) {
  console.error('Repository guardrail verification FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Repository guardrail verification PASSED.');
console.log(`Required checks: ${required.join(', ')}`);
console.log('Strict updates, admin enforcement, PR flow, conversation resolution, force-push blocking, and deletion blocking are active.');
NODE
