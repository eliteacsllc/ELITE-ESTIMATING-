import type { ValuationResult } from './market-valuation.js';
import type { DiminishedValueResult } from './diminished-value.js';
import type { AcvResult } from './acv-engine.js';

export type ValuationRevisionKind = 'market_value' | 'acv' | 'diminished_value';

export type ValuationRevision<T = ValuationResult | AcvResult | DiminishedValueResult> = {
  id: string;
  claimId?: string;
  kind: ValuationRevisionKind;
  createdAt: string;
  createdBy: string;
  reason: string;
  supersedesId?: string;
  selectedComparableIds: string[];
  result: T;
  evidenceSnapshot: unknown[];
  approved: boolean;
  approval?: { approvedBy: string; approvedAt: string; note?: string };
};

function marketResultOf(result:ValuationResult|AcvResult|DiminishedValueResult):ValuationResult {
  if('valuation' in result) return result.valuation;
  if('preLoss' in result) return result.preLoss;
  return result;
}

export function createValuationRevision<T extends ValuationResult | AcvResult | DiminishedValueResult>(input: {
  claimId?: string;
  kind: ValuationRevisionKind;
  createdBy: string;
  reason: string;
  result: T;
  supersedes?: ValuationRevision;
}): ValuationRevision<T> {
  const market=marketResultOf(input.result);
  return {
    id: `valrev_${crypto.randomUUID()}`,
    claimId: input.claimId,
    kind: input.kind,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    reason: input.reason.trim() || 'valuation_updated',
    supersedesId: input.supersedes?.id,
    selectedComparableIds: [...market.selectedComparableIds],
    result: structuredClone(input.result),
    evidenceSnapshot: structuredClone(market.evidence),
    approved: false,
  };
}

export function approveValuationRevision<T>(revision: ValuationRevision<T>, input: { approvedBy: string; note?: string }): ValuationRevision<T> {
  if (!input.approvedBy.trim()) throw new Error('approved_by_required');
  return {
    ...revision,
    approved: true,
    approval: { approvedBy: input.approvedBy, approvedAt: new Date().toISOString(), note: input.note?.trim() || undefined },
  };
}

export function validateRevisionChain(revisions: ValuationRevision[]): { ok: boolean; errors: string[] } {
  const ids = new Set(revisions.map(r => r.id));
  const errors: string[] = [];
  for (const revision of revisions) {
    if (revision.supersedesId && !ids.has(revision.supersedesId)) errors.push(`missing_superseded_revision:${revision.id}`);
    if (revision.supersedesId === revision.id) errors.push(`self_supersede:${revision.id}`);
  }
  return { ok: errors.length === 0, errors };
}
