import { loadLaunchManifest, evaluateLaunchReadiness } from './readiness.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: npm run launch:check -- <manifest.json>');
  process.exit(2);
}

try {
  const manifest = await loadLaunchManifest(path);
  const result = evaluateLaunchReadiness(manifest);
  console.log(JSON.stringify(result, null, 2));
  if (!result.green) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ green: false, error: error instanceof Error ? error.message : 'launch_readiness_failed' }, null, 2));
  process.exitCode = 2;
}
