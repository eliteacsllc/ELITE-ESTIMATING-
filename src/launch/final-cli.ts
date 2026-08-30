import { evaluateLaunchReadiness, loadLaunchManifest } from './readiness.js';
import { evaluateBenchmarkCertification, loadBenchmarkCertificationManifest } from '../benchmarks/certification.js';

const launchPath = process.argv[2];
const benchmarkPath = process.argv[3];
if (!launchPath || !benchmarkPath) {
  console.error('usage: npm run launch:final -- <launch-manifest.json> <benchmark-certification.json>');
  process.exit(2);
}

try {
  const [launchManifest, benchmarkManifest] = await Promise.all([
    loadLaunchManifest(launchPath),
    loadBenchmarkCertificationManifest(benchmarkPath),
  ]);

  const launch = evaluateLaunchReadiness(launchManifest);
  const benchmark = evaluateBenchmarkCertification(benchmarkManifest);
  const scopeMatches = benchmarkManifest.market.trim().toUpperCase() === launchManifest.market.trim().toUpperCase()
    && launchManifest.assetClasses.every(assetClass => benchmarkManifest.assetClasses.includes(assetClass));
  const scopeFindings = scopeMatches ? [] : [{
    gate: 'benchmark_scope',
    severity: 'blocker' as const,
    message: 'benchmark certification must cover the launch market and every launch asset class',
  }];

  const green = launch.green && benchmark.green && scopeFindings.length === 0;
  console.log(JSON.stringify({ green, launch, benchmark: { ...benchmark, findings: [...benchmark.findings, ...scopeFindings] } }, null, 2));
  if (!green) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ green: false, error: error instanceof Error ? error.message : 'final_launch_certification_failed' }, null, 2));
  process.exitCode = 2;
}
