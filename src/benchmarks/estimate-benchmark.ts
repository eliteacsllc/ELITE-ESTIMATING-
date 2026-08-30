import type { EstimateLine } from '../domain/types.js';

export type BenchmarkCase = {
  id: string;
  assetClass: string;
  jurisdiction: string;
  expertReviewed: boolean;
  referenceLines: EstimateLine[];
};

export type BenchmarkThresholds = {
  minimumLineRecall: number;
  minimumLinePrecision: number;
  maximumAbsoluteCostVariancePercent: number;
  maximumSafetyCriticalOmissions: number;
};

export type BenchmarkResult = {
  caseId: string;
  lineRecall: number;
  linePrecision: number;
  absoluteCostVariancePercent: number;
  safetyCriticalOmissions: string[];
  green: boolean;
  blockers: string[];
};

function normalizedKey(line: EstimateLine): string {
  return `${line.category}|${line.component}|${line.operation}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

function totalMinor(lines: EstimateLine[]): number {
  return lines.reduce((sum, line) => sum + line.total.amountMinor, 0);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function scoreEstimateAgainstExpert(
  benchmark: BenchmarkCase,
  candidateLines: EstimateLine[],
  thresholds: BenchmarkThresholds,
): BenchmarkResult {
  if (!benchmark.expertReviewed) throw new Error(`benchmark_not_expert_reviewed:${benchmark.id}`);

  const referenceKeys = new Set(benchmark.referenceLines.map(normalizedKey));
  const candidateKeys = new Set(candidateLines.map(normalizedKey));
  const matched = [...candidateKeys].filter(key => referenceKeys.has(key));

  const lineRecall = ratio(matched.length, referenceKeys.size);
  const linePrecision = ratio(matched.length, candidateKeys.size);
  const referenceTotal = totalMinor(benchmark.referenceLines);
  const candidateTotal = totalMinor(candidateLines);
  const absoluteCostVariancePercent = referenceTotal === 0
    ? (candidateTotal === 0 ? 0 : 100)
    : Math.abs(candidateTotal - referenceTotal) / referenceTotal * 100;

  const safetyCriticalOmissions = benchmark.referenceLines
    .filter(line => line.safetyCritical)
    .filter(line => !candidateKeys.has(normalizedKey(line)))
    .map(line => line.id);

  const blockers: string[] = [];
  if (lineRecall < thresholds.minimumLineRecall) blockers.push('line_recall_below_threshold');
  if (linePrecision < thresholds.minimumLinePrecision) blockers.push('line_precision_below_threshold');
  if (absoluteCostVariancePercent > thresholds.maximumAbsoluteCostVariancePercent) blockers.push('cost_variance_above_threshold');
  if (safetyCriticalOmissions.length > thresholds.maximumSafetyCriticalOmissions) blockers.push('safety_critical_omission');

  return {
    caseId: benchmark.id,
    lineRecall,
    linePrecision,
    absoluteCostVariancePercent,
    safetyCriticalOmissions,
    green: blockers.length === 0,
    blockers,
  };
}

export type BenchmarkSuiteResult = {
  green: boolean;
  cases: BenchmarkResult[];
  meanLineRecall: number;
  meanLinePrecision: number;
  meanAbsoluteCostVariancePercent: number;
  totalSafetyCriticalOmissions: number;
};

export function scoreBenchmarkSuite(
  benchmarks: BenchmarkCase[],
  candidateByCaseId: ReadonlyMap<string, EstimateLine[]>,
  thresholds: BenchmarkThresholds,
): BenchmarkSuiteResult {
  if (benchmarks.length === 0) throw new Error('benchmark_suite_empty');
  const cases = benchmarks.map(benchmark => {
    const candidate = candidateByCaseId.get(benchmark.id);
    if (!candidate) throw new Error(`candidate_missing:${benchmark.id}`);
    return scoreEstimateAgainstExpert(benchmark, candidate, thresholds);
  });
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    green: cases.every(result => result.green),
    cases,
    meanLineRecall: mean(cases.map(result => result.lineRecall)),
    meanLinePrecision: mean(cases.map(result => result.linePrecision)),
    meanAbsoluteCostVariancePercent: mean(cases.map(result => result.absoluteCostVariancePercent)),
    totalSafetyCriticalOmissions: cases.reduce((sum, result) => sum + result.safetyCriticalOmissions.length, 0),
  };
}
