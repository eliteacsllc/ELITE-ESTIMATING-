import { evaluateBenchmarkCertification, loadBenchmarkCertificationManifest } from './certification.js';

const path = process.argv[2] ?? process.env.ELITE_BENCHMARK_CERTIFICATION ?? 'launch/benchmark-certification.json';

try {
  const manifest = await loadBenchmarkCertificationManifest(path);
  const result = evaluateBenchmarkCertification(manifest);
  process.stdout.write(`${JSON.stringify({ path, ...result }, null, 2)}\n`);
  if (!result.green) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
