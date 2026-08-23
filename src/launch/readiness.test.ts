import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertLaunchManifest, evaluateLaunchReadiness, type LaunchManifest } from './readiness.js';

const manifest: LaunchManifest = {
  version: 1,
  market: 'US',
  assetClasses: ['passenger_vehicle'],
  dataRights: [{ provider: 'licensed-provider', capabilities: ['parts','labor'], regions: ['US'], agreementReference: 'contract-123', approved: true }],
  safetyCoverage: [
    { category: 'structural', source: 'OEM', regions: ['US'], approved: true },
    { category: 'restraint', source: 'OEM', regions: ['US'], approved: true },
    { category: 'adas', source: 'OEM', regions: ['US'], approved: true },
    { category: 'ev_hv', source: 'OEM', regions: ['US'], approved: true },
  ],
  privacyReviewReference: 'privacy-1', privacyApproved: true,
  securityReviewReference: 'security-1', securityApproved: true,
  pilotEvidenceReference: 'pilot-1', pilotValidated: true,
  backupRestoreEvidenceReference: 'ci-backup-restore', rpoMinutes: 60, rtoMinutes: 240,
};

const env: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://db', ELITE_AUTH_SECRET: '12345678901234567890123456789012',
  ELITE_REQUIRE_IDEMPOTENCY: '1', ELITE_REQUIRE_RATE_LIMIT: '1', ELITE_RATE_LIMIT_CAPACITY: '100', ELITE_RATE_LIMIT_REFILL_PER_SECOND: '10',
  ELITE_METRICS_TOKEN: '12345678901234567890123456789012', ELITE_REQUIRE_BLOB_STORAGE: '1',
  R2_ACCOUNT_ID: 'acct', R2_BUCKET: 'bucket', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret',
  ELITE_CLAIMS_WEBHOOK_URL: 'https://claims.example.test/webhook', ELITE_CLAIMS_WEBHOOK_SECRET: '12345678901234567890123456789012',
  ELITE_OUTBOX_MAX_PENDING: '100', ELITE_OUTBOX_MAX_AGE_SECONDS: '300', ELITE_OUTBOX_MAX_EXHAUSTED: '0',
};

test('synthetic fully evidenced configuration can become green', () => {
  const result = evaluateLaunchReadiness(manifest, env);
  assert.equal(result.green, true);
  assert.deepEqual(result.findings.filter(f => f.severity === 'blocker'), []);
  assert.ok(result.findings.some(f => f.gate === 'authentication' && f.severity === 'warning'));
});

test('missing ADAS evidence blocks launch', () => {
  const result = evaluateLaunchReadiness({ ...manifest, safetyCoverage: manifest.safetyCoverage.filter(item => item.category !== 'adas') }, env);
  assert.equal(result.green, false);
  assert.ok(result.findings.some(f => f.gate === 'safety' && f.message.includes('adas')));
});

test('missing production controls blocks launch', () => {
  const result = evaluateLaunchReadiness(manifest, {});
  assert.equal(result.green, false);
  assert.ok(result.findings.some(f => f.gate === 'persistence'));
  assert.ok(result.findings.some(f => f.gate === 'evidence_storage'));
  assert.ok(result.findings.some(f => f.gate === 'claims_integration'));
});

test('malformed manifest is rejected before evaluation', () => {
  assert.throws(() => assertLaunchManifest({ version: 1, market: 'US', assetClasses: 'auto' }), /invalid_launch_manifest_product/);
});

test('shipped example manifest cannot certify production', async () => {
  const value: unknown = JSON.parse(await readFile('launch/launch-manifest.example.json', 'utf8'));
  assertLaunchManifest(value);
  const result = evaluateLaunchReadiness(value, env);
  assert.equal(result.green, false);
  assert.ok(result.findings.some(f => f.gate === 'data_rights'));
  assert.ok(result.findings.some(f => f.gate === 'safety'));
  assert.ok(result.findings.some(f => f.gate === 'privacy'));
  assert.ok(result.findings.some(f => f.gate === 'pilot'));
});
