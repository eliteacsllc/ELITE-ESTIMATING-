import { readFile } from 'node:fs/promises';

export type LaunchDataRight = { provider: string; capabilities: string[]; regions: string[]; agreementReference: string; approved: boolean };
export type LaunchSafetyCoverage = { category: 'structural' | 'restraint' | 'adas' | 'ev_hv' | 'property_code' | 'other'; source: string; regions: string[]; approved: boolean };
export type LaunchManifest = {
  version: 1; market: string; assetClasses: string[]; dataRights: LaunchDataRight[]; safetyCoverage: LaunchSafetyCoverage[];
  privacyReviewReference: string; privacyApproved: boolean; securityReviewReference: string; securityApproved: boolean;
  pilotEvidenceReference: string; pilotValidated: boolean; backupRestoreEvidenceReference: string; rpoMinutes: number; rtoMinutes: number;
};
export type LaunchFinding = { gate: string; severity: 'blocker' | 'warning'; message: string };
export type LaunchReadiness = { green: boolean; market: string | null; findings: LaunchFinding[] };

function configured(value: string | undefined): boolean { return Boolean(value?.trim()); }
function enabled(value: string | undefined): boolean { return value === '1'; }
function positiveInteger(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }
function stringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0); }
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

export function assertLaunchManifest(value: unknown): asserts value is LaunchManifest {
  if (!object(value) || value.version !== 1) throw new Error('invalid_launch_manifest_version');
  if (typeof value.market !== 'string' || !stringArray(value.assetClasses)) throw new Error('invalid_launch_manifest_product');
  if (!Array.isArray(value.dataRights) || !value.dataRights.every(item => object(item) && typeof item.provider === 'string' && stringArray(item.capabilities) && stringArray(item.regions) && typeof item.agreementReference === 'string' && typeof item.approved === 'boolean')) throw new Error('invalid_launch_manifest_data_rights');
  const safetyCategories = new Set(['structural','restraint','adas','ev_hv','property_code','other']);
  if (!Array.isArray(value.safetyCoverage) || !value.safetyCoverage.every(item => object(item) && typeof item.category === 'string' && safetyCategories.has(item.category) && typeof item.source === 'string' && stringArray(item.regions) && typeof item.approved === 'boolean')) throw new Error('invalid_launch_manifest_safety');
  for (const key of ['privacyReviewReference','securityReviewReference','pilotEvidenceReference','backupRestoreEvidenceReference'] as const) if (typeof value[key] !== 'string') throw new Error(`invalid_launch_manifest_${key}`);
  for (const key of ['privacyApproved','securityApproved','pilotValidated'] as const) if (typeof value[key] !== 'boolean') throw new Error(`invalid_launch_manifest_${key}`);
  if (typeof value.rpoMinutes !== 'number' || typeof value.rtoMinutes !== 'number') throw new Error('invalid_launch_manifest_recovery');
}

export function evaluateLaunchReadiness(manifest: LaunchManifest, env: NodeJS.ProcessEnv = process.env): LaunchReadiness {
  const findings: LaunchFinding[] = [];
  const block = (gate: string, message: string) => findings.push({ gate, severity: 'blocker' as const, message });
  const warn = (gate: string, message: string) => findings.push({ gate, severity: 'warning' as const, message });
  if (!manifest.market.trim()) block('market', 'market is required');
  if (manifest.assetClasses.length === 0) block('product', 'at least one validated asset class is required');
  if (!configured(env.DATABASE_URL)) block('persistence', 'DATABASE_URL is required');
  if (enabled(env.ELITE_ALLOW_EPHEMERAL)) block('persistence', 'ephemeral storage must be disabled');
  const oidcConfigured = configured(env.ELITE_OIDC_ISSUER) && configured(env.ELITE_OIDC_AUDIENCE) && configured(env.ELITE_OIDC_JWKS_URL);
  const serviceTokenConfigured = (env.ELITE_AUTH_SECRET?.length ?? 0) >= 32;
  if (!oidcConfigured && !serviceTokenConfigured) block('authentication', 'OIDC/JWKS or a strong service-token secret is required');
  if (!oidcConfigured) warn('authentication', 'enterprise OIDC/JWKS is not configured');
  if (!enabled(env.ELITE_REQUIRE_IDEMPOTENCY)) block('mutation_safety', 'ELITE_REQUIRE_IDEMPOTENCY must be enabled');
  if (!enabled(env.ELITE_REQUIRE_RATE_LIMIT)) block('abuse_control', 'ELITE_REQUIRE_RATE_LIMIT must be enabled');
  if (!configured(env.ELITE_RATE_LIMIT_CAPACITY) || !configured(env.ELITE_RATE_LIMIT_REFILL_PER_SECOND)) block('abuse_control', 'rate-limit capacity and refill must be configured');
  if (!configured(env.ELITE_METRICS_TOKEN) || (env.ELITE_METRICS_TOKEN?.length ?? 0) < 32) block('observability', 'protected metrics must be configured');
  if (!enabled(env.ELITE_REQUIRE_BLOB_STORAGE)) block('evidence_storage', 'ELITE_REQUIRE_BLOB_STORAGE must be enabled');
  for (const name of ['R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'] as const) if (!configured(env[name])) block('evidence_storage', `${name} is required`);
  if (!configured(env.ELITE_CLAIMS_WEBHOOK_URL) || !configured(env.ELITE_CLAIMS_WEBHOOK_SECRET)) block('claims_integration', 'Claims Management webhook URL and secret are required');
  if ((env.ELITE_CLAIMS_WEBHOOK_SECRET?.length ?? 0) < 32) block('claims_integration', 'Claims Management webhook secret must be at least 32 characters');
  if (!configured(env.ELITE_OUTBOX_MAX_PENDING) || !configured(env.ELITE_OUTBOX_MAX_AGE_SECONDS) || !configured(env.ELITE_OUTBOX_MAX_EXHAUSTED)) block('claims_integration', 'production outbox health thresholds must be configured');
  if (manifest.dataRights.length === 0) block('data_rights', 'at least one lawful data-source agreement record is required');
  for (const right of manifest.dataRights) if (!right.provider.trim() || right.capabilities.length === 0 || right.regions.length === 0 || !right.agreementReference.trim() || !right.approved) block('data_rights', `incomplete or unapproved data-rights record for ${right.provider || 'unnamed provider'}`);
  const requiredSafety = new Set(['structural', 'restraint', 'adas', 'ev_hv']);
  for (const coverage of manifest.safetyCoverage) if (coverage.approved && coverage.source.trim() && coverage.regions.length > 0) requiredSafety.delete(coverage.category);
  for (const category of requiredSafety) block('safety', `approved ${category} safety coverage is required`);
  if (!manifest.privacyApproved || !manifest.privacyReviewReference.trim()) block('privacy', 'approved privacy review evidence is required');
  if (!manifest.securityApproved || !manifest.securityReviewReference.trim()) block('security', 'approved security review evidence is required');
  if (!manifest.pilotValidated || !manifest.pilotEvidenceReference.trim()) block('pilot', 'validated market pilot evidence is required');
  if (!manifest.backupRestoreEvidenceReference.trim()) block('recovery', 'backup/restore evidence reference is required');
  if (!positiveInteger(manifest.rpoMinutes)) block('recovery', 'business-approved positive RPO is required');
  if (!positiveInteger(manifest.rtoMinutes)) block('recovery', 'business-approved positive RTO is required');
  return { green: !findings.some(finding => finding.severity === 'blocker'), market: manifest.market.trim() || null, findings };
}

export async function loadLaunchManifest(path: string): Promise<LaunchManifest> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  assertLaunchManifest(parsed);
  return parsed;
}
