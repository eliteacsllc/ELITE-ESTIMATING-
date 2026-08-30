import { readFile } from 'node:fs/promises';

export type BenchmarkCertificationManifest = {
  version: 1;
  evidenceReference: string;
  market: string;
  assetClasses: string[];
  totalCases: number;
  expertReviewedCases: number;
  meanLineRecall: number;
  meanLinePrecision: number;
  meanAbsoluteCostVariancePercent: number;
  totalSafetyCriticalOmissions: number;
  thresholds: {
    minimumCases: number;
    minimumLineRecall: number;
    minimumLinePrecision: number;
    maximumMeanAbsoluteCostVariancePercent: number;
    maximumSafetyCriticalOmissions: number;
  };
  approvedByExpert: boolean;
  approvedAt: string;
};

export type BenchmarkCertificationFinding = {
  gate: string;
  severity: 'blocker' | 'warning';
  message: string;
};

export type BenchmarkCertificationResult = {
  green: boolean;
  findings: BenchmarkCertificationFinding[];
};

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertBenchmarkCertificationManifest(value: unknown): asserts value is BenchmarkCertificationManifest {
  if (!object(value) || value.version !== 1) throw new Error('invalid_benchmark_certification_version');
  if (!nonEmptyString(value.evidenceReference) || !nonEmptyString(value.market)) throw new Error('invalid_benchmark_certification_identity');
  if (!Array.isArray(value.assetClasses) || value.assetClasses.length === 0 || !value.assetClasses.every(nonEmptyString)) throw new Error('invalid_benchmark_certification_asset_classes');
  if (!positiveInteger(value.totalCases) || !nonNegativeInteger(value.expertReviewedCases)) throw new Error('invalid_benchmark_certification_case_counts');
  if (!finiteUnitInterval(value.meanLineRecall) || !finiteUnitInterval(value.meanLinePrecision)) throw new Error('invalid_benchmark_certification_line_metrics');
  if (!nonNegativeNumber(value.meanAbsoluteCostVariancePercent) || !nonNegativeInteger(value.totalSafetyCriticalOmissions)) throw new Error('invalid_benchmark_certification_error_metrics');
  if (!object(value.thresholds)) throw new Error('invalid_benchmark_certification_thresholds');
  if (!positiveInteger(value.thresholds.minimumCases) || !finiteUnitInterval(value.thresholds.minimumLineRecall) || !finiteUnitInterval(value.thresholds.minimumLinePrecision) || !nonNegativeNumber(value.thresholds.maximumMeanAbsoluteCostVariancePercent) || !nonNegativeInteger(value.thresholds.maximumSafetyCriticalOmissions)) throw new Error('invalid_benchmark_certification_thresholds');
  if (typeof value.approvedByExpert !== 'boolean' || typeof value.approvedAt !== 'string') throw new Error('invalid_benchmark_certification_approval');
}

export function evaluateBenchmarkCertification(manifest: BenchmarkCertificationManifest): BenchmarkCertificationResult {
  const findings: BenchmarkCertificationFinding[] = [];
  const block = (gate: string, message: string) => findings.push({ gate, severity: 'blocker' as const, message });

  if (manifest.totalCases < manifest.thresholds.minimumCases) block('benchmark_volume', `benchmark suite has ${manifest.totalCases} cases; minimum is ${manifest.thresholds.minimumCases}`);
  if (manifest.expertReviewedCases !== manifest.totalCases) block('benchmark_review', 'every benchmark case must be expert-reviewed');
  if (manifest.meanLineRecall < manifest.thresholds.minimumLineRecall) block('benchmark_recall', 'mean line recall is below the approved threshold');
  if (manifest.meanLinePrecision < manifest.thresholds.minimumLinePrecision) block('benchmark_precision', 'mean line precision is below the approved threshold');
  if (manifest.meanAbsoluteCostVariancePercent > manifest.thresholds.maximumMeanAbsoluteCostVariancePercent) block('benchmark_cost', 'mean absolute cost variance exceeds the approved threshold');
  if (manifest.totalSafetyCriticalOmissions > manifest.thresholds.maximumSafetyCriticalOmissions) block('benchmark_safety', 'safety-critical omissions exceed the approved threshold');
  if (!manifest.approvedByExpert) block('benchmark_approval', 'qualified expert approval is required');
  if (!manifest.approvedAt.trim() || Number.isNaN(Date.parse(manifest.approvedAt))) block('benchmark_approval', 'a valid expert approval timestamp is required');
  if (!manifest.evidenceReference.trim()) block('benchmark_evidence', 'benchmark evidence reference is required');

  return { green: !findings.some(finding => finding.severity === 'blocker'), findings };
}

export async function loadBenchmarkCertificationManifest(path: string): Promise<BenchmarkCertificationManifest> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  assertBenchmarkCertificationManifest(parsed);
  return parsed;
}
