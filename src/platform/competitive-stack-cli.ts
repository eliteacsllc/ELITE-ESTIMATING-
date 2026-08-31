import { readFile } from 'node:fs/promises';
import { certifyCompetitiveStack } from './competitive-stack.js';
import type { AssetClass } from '../domain/types.js';
import type { AutomationLevel, FeatureId } from './features.js';

type CompetitiveProfile = {
  assetClass: AssetClass;
  enabledFeatures: FeatureId[];
  automationLevel: AutomationLevel;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseProfile(value: unknown): CompetitiveProfile {
  if (!isRecord(value)) throw new Error('competitive_profile_invalid');
  if (typeof value.assetClass !== 'string') throw new Error('competitive_profile_asset_class_required');
  if (!Array.isArray(value.enabledFeatures) || !value.enabledFeatures.every(item => typeof item === 'string')) throw new Error('competitive_profile_features_required');
  if (typeof value.automationLevel !== 'string') throw new Error('competitive_profile_automation_required');
  return value as unknown as CompetitiveProfile;
}

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run competitive:check -- <profile.json>');
  process.exit(2);
}

try {
  const profile = parseProfile(JSON.parse(await readFile(path, 'utf8')));
  const result = certifyCompetitiveStack(profile);
  console.log(JSON.stringify(result, null, 2));
  if (!result.green) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
