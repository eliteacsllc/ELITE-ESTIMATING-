#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
SHA="$(git rev-parse HEAD)"
OUT="$ROOT/release-evidence"
mkdir -p "$OUT"

echo "Elite Estimating local certification @ $SHA"
node -e "const x=JSON.parse(require('fs').readFileSync('production-readiness.json')); if(!x.required_gates) process.exit(1)"
npm ci --ignore-scripts --no-audit --no-fund
npm run verify

if [ -n "${DATABASE_URL:-}" ]; then
  npm run migrate
  npm run smoke:postgres:tenant-isolation
  npm run smoke:postgres:rate-limit
  npm run smoke:postgres:transactions
  npm run smoke:postgres:schema
else
  echo "DATABASE_URL is required for database certification" >&2
  exit 2
fi

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$OUT/estimating-$SHA.json" <<JSON
{
  "contract": "elite.estimating.local-certification.v2",
  "repository": "eliteacsllc/ELITE-ESTIMATING-",
  "sha": "$SHA",
  "timestamp_utc": "$STAMP",
  "result": "repository-and-database-gates-passed",
  "remaining_live_gates": ["production-dns-tls","provider-contracts","production-smoke","rollback-proof"]
}
JSON
cat "$OUT/estimating-$SHA.json"
