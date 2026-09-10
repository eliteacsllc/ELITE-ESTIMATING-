import type {
  EstimateLine,
  EstimateOperation,
  Money,
  SourceProvenance,
} from '../domain/types.js';
import { lineTotal } from '../engine/estimate.js';

const operations = new Set<EstimateOperation>([
  'repair', 'replace', 'remove_install', 'remove_replace', 'refinish',
  'blend', 'inspect', 'scan', 'calibrate', 'measure', 'clean',
  'demolish', 'install', 'detach_reset', 'other',
]);

export type ExternalEstimateLine = {
  sourceLineId: string;
  category: string;
  component: string;
  operation: string;
  quantity: number;
  unit?: string;
  laborHours?: number;
  laborRate?: Money;
  partOrMaterial?: Money;
  equipment?: Money;
  tax?: Money;
  procedureRefs?: string[];
  safetyCritical?: boolean;
  confidence?: number;
  provenance: SourceProvenance[];
};

export type EstimateNormalizationInput = {
  tenantId: string;
  estimateId: string;
  currency: string;
  lines: ExternalEstimateLine[];
};

export type NormalizationIssue = {
  severity: 'blocker' | 'review';
  code: string;
  sourceLineId: string;
};

export type EstimateNormalizationResult = {
  tenantId: string;
  estimateId: string;
  currency: string;
  lines: EstimateLine[];
  issues: NormalizationIssue[];
  humanApprovalRequired: true;
  readyForHumanReview: boolean;
};

function currencies(line: ExternalEstimateLine): string[] {
  return [
    line.laborRate,
    line.partOrMaterial,
    line.equipment,
    line.tax,
  ].filter((value): value is Money => Boolean(value)).map((value) => value.currency);
}

function normalizedRefs(values: string[] | undefined): string[] | undefined {
  const result = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
  return result.length ? result : undefined;
}

function validateProvenance(
  sourceLineId: string,
  provenance: SourceProvenance[],
  issues: NormalizationIssue[],
): SourceProvenance[] {
  if (!provenance.length) {
    issues.push({ severity: 'blocker', code: 'provenance_required', sourceLineId });
    return [];
  }

  const seen = new Set<string>();
  return provenance.map((source) => {
    if (!source.provider.trim()) {
      issues.push({ severity: 'blocker', code: 'provider_required', sourceLineId });
    }
    if (!Number.isFinite(Date.parse(source.retrievedAt))) {
      issues.push({ severity: 'blocker', code: 'retrieved_at_invalid', sourceLineId });
    }
    if (source.confidence !== undefined && (source.confidence < 0 || source.confidence > 1)) {
      issues.push({ severity: 'blocker', code: 'source_confidence_invalid', sourceLineId });
    }

    const identity = `${source.provider.trim().toLowerCase()}|${source.sourceId ?? ''}|${source.retrievedAt}`;
    if (seen.has(identity)) {
      issues.push({ severity: 'review', code: 'duplicate_provenance', sourceLineId });
    }
    seen.add(identity);
    return { ...source, provider: source.provider.trim() };
  });
}

/**
 * Converts provider-neutral estimate input into governed draft lines.
 * It never imports an external approval state: every normalized line is
 * unapproved and must pass qualified human review.
 */
export function normalizeEstimateProposal(
  input: EstimateNormalizationInput,
): EstimateNormalizationResult {
  if (!input.tenantId || !input.estimateId || !input.currency.trim()) {
    throw new Error('normalization_scope_required');
  }

  const issues: NormalizationIssue[] = [];
  const usedIds = new Set<string>();
  const lines: EstimateLine[] = [];

  for (const source of input.lines) {
    const sourceLineId = source.sourceLineId.trim();
    if (!sourceLineId) {
      issues.push({ severity: 'blocker', code: 'source_line_id_required', sourceLineId: '' });
      continue;
    }
    if (usedIds.has(sourceLineId)) {
      issues.push({ severity: 'blocker', code: 'duplicate_source_line_id', sourceLineId });
      continue;
    }
    usedIds.add(sourceLineId);

    if (!source.category.trim()) issues.push({ severity: 'blocker', code: 'category_required', sourceLineId });
    if (!source.component.trim()) issues.push({ severity: 'blocker', code: 'component_required', sourceLineId });
    if (!operations.has(source.operation as EstimateOperation)) {
      issues.push({ severity: 'blocker', code: 'operation_unsupported', sourceLineId });
      continue;
    }
    if (!Number.isFinite(source.quantity) || source.quantity <= 0) {
      issues.push({ severity: 'blocker', code: 'quantity_invalid', sourceLineId });
    }
    if (source.laborHours !== undefined && (!Number.isFinite(source.laborHours) || source.laborHours < 0)) {
      issues.push({ severity: 'blocker', code: 'labor_hours_invalid', sourceLineId });
    }
    if (currencies(source).some((currency) => currency !== input.currency)) {
      issues.push({ severity: 'blocker', code: 'currency_mismatch', sourceLineId });
      continue;
    }
    if (source.confidence !== undefined && (source.confidence < 0 || source.confidence > 1)) {
      issues.push({ severity: 'blocker', code: 'line_confidence_invalid', sourceLineId });
    }

    const procedureRefs = normalizedRefs(source.procedureRefs);
    if (source.safetyCritical && !procedureRefs) {
      issues.push({ severity: 'blocker', code: 'safety_procedure_required', sourceLineId });
    }
    if (source.confidence !== undefined && source.confidence < 0.75) {
      issues.push({ severity: 'review', code: 'low_confidence', sourceLineId });
    }

    const provenance = validateProvenance(sourceLineId, source.provenance, issues);
    const base = {
      id: sourceLineId,
      category: source.category.trim(),
      component: source.component.trim(),
      operation: source.operation as EstimateOperation,
      quantity: source.quantity,
      ...(source.unit ? { unit: source.unit.trim() } : {}),
      ...(source.laborHours !== undefined ? { laborHours: source.laborHours } : {}),
      ...(source.laborRate ? { laborRate: source.laborRate } : {}),
      ...(source.partOrMaterial ? { partOrMaterial: source.partOrMaterial } : {}),
      ...(source.equipment ? { equipment: source.equipment } : {}),
      ...(source.tax ? { tax: source.tax } : {}),
      ...(procedureRefs ? { procedureRefs } : {}),
      ...(source.safetyCritical !== undefined ? { safetyCritical: source.safetyCritical } : {}),
      aiSuggested: source.confidence !== undefined,
      ...(source.confidence !== undefined ? { aiConfidence: source.confidence } : {}),
      humanApproved: false,
      provenance,
    };
    lines.push({ ...base, total: lineTotal(base) });
  }

  return {
    tenantId: input.tenantId,
    estimateId: input.estimateId,
    currency: input.currency,
    lines,
    issues,
    humanApprovalRequired: true,
    readyForHumanReview: !issues.some((issue) => issue.severity === 'blocker'),
  };
}
