#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-eliteacsllc/ELITE-ESTIMATING-}"
BRANCH="${2:-main}"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) is required." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: Authenticate first with: gh auth login" >&2
  exit 1
fi

cat <<EOF
Configuring repository guardrails for ${REPO}:${BRANCH}
- require the 'core' CI status check
- require the 'analyze-javascript-typescript' CodeQL status check
- require the 'evidence' release-provenance/SBOM status check
- require branches to be up to date before merge
- require pull-request review flow with zero mandatory approvals (safe for a single-owner repo)
- dismiss stale approvals if collaborators are added later
- require conversation resolution
- block force pushes and branch deletion
- enforce protections for administrators
EOF

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["core", "analyze-javascript-typescript", "evidence"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

echo "Guardrails API update completed; verifying readback..."
bash "${SCRIPT_DIR}/verify-repository-guardrails.sh" "$REPO" "$BRANCH"
echo "Guardrails configured and verified. Review at: https://github.com/${REPO}/settings/branches"
