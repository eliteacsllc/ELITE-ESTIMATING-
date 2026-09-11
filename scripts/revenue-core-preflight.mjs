const required = [
  ['DATABASE_URL', value => /^postgres(?:ql)?:\/\//i.test(value)],
  ['ELITE_METRICS_TOKEN', value => value.length >= 32],
];

const authConfigured = Boolean(
  (process.env.ELITE_AUTH_SECRET || '').length >= 32 ||
  (process.env.ELITE_OIDC_ISSUER && process.env.ELITE_OIDC_AUDIENCE && process.env.ELITE_OIDC_JWKS_URL)
);

const r2Configured = Boolean(
  /^[a-f0-9]{32}$/i.test(String(process.env.R2_ACCOUNT_ID || '').trim()) &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET
);

const capacity = Number(process.env.ELITE_RATE_LIMIT_CAPACITY);
const refill = Number(process.env.ELITE_RATE_LIMIT_REFILL_PER_SECOND);
const rateLimitPolicyConfigured = Number.isFinite(capacity) && capacity > 0 && Number.isFinite(refill) && refill > 0;

const findings = [];
for (const [name, validate] of required) {
  const value = String(process.env[name] || '').trim();
  if (!value || !validate(value)) findings.push(`${name}_missing_or_invalid`);
}
if (!authConfigured) findings.push('production_auth_missing');
if (process.env.ELITE_REQUIRE_IDEMPOTENCY !== '1') findings.push('ELITE_REQUIRE_IDEMPOTENCY_must_equal_1');
if (process.env.ELITE_REQUIRE_RATE_LIMIT !== '1') findings.push('ELITE_REQUIRE_RATE_LIMIT_must_equal_1');
if (!rateLimitPolicyConfigured) findings.push('rate_limit_policy_missing_or_invalid');
if (process.env.ELITE_REQUIRE_BLOB_STORAGE !== '1') findings.push('ELITE_REQUIRE_BLOB_STORAGE_must_equal_1');
if (!r2Configured) findings.push('r2_evidence_storage_missing_or_invalid');
if (process.env.ELITE_ALLOW_EPHEMERAL === '1') findings.push('ELITE_ALLOW_EPHEMERAL_must_not_equal_1');

const result = {
  green: findings.length === 0,
  checks: {
    durablePostgres: !findings.includes('DATABASE_URL_missing_or_invalid'),
    authConfigured,
    idempotencyRequired: process.env.ELITE_REQUIRE_IDEMPOTENCY === '1',
    rateLimitRequired: process.env.ELITE_REQUIRE_RATE_LIMIT === '1',
    rateLimitPolicyConfigured,
    blobStorageRequired: process.env.ELITE_REQUIRE_BLOB_STORAGE === '1',
    r2Configured,
    metricsConfigured: !findings.includes('ELITE_METRICS_TOKEN_missing_or_invalid'),
    ephemeralDisabled: process.env.ELITE_ALLOW_EPHEMERAL !== '1',
  },
  findings,
};

console.log(JSON.stringify(result, null, 2));
if (!result.green) process.exitCode = 1;
