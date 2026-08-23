import { randomUUID } from 'node:crypto';
import type { Estimate, EstimateLine } from '../domain/types.js';

export type SupplementChange = {
  type: 'add' | 'remove' | 'replace';
  lineId?: string;
  line?: EstimateLine;
  reason: string;
  requestedBy: string;
  requestedAt: string;
};

export type Supplement = {
  id: string;
  estimateId: string;
  baseRevision: number;
  changes: SupplementChange[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt: string;
};

export function createSupplement(estimate: Estimate, id: string = randomUUID()): Supplement {
  if (estimate.status !== 'approved') throw new Error('supplement_requires_approved_estimate');
  return {
    id,
    estimateId: estimate.id,
    baseRevision: estimate.revision,
    changes: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}

export function applyApprovedSupplement(estimate: Estimate, supplement: Supplement): Estimate {
  if (supplement.status !== 'approved') throw new Error('supplement_not_approved');
  if (supplement.estimateId !== estimate.id || supplement.baseRevision !== estimate.revision) {
    throw new Error('stale_supplement_revision');
  }
  const lines = new Map(estimate.lines.map((line) => [line.id, line]));
  for (const change of supplement.changes) {
    if (change.type === 'add') {
      if (!change.line) throw new Error('supplement_add_requires_line');
      lines.set(change.line.id, change.line);
    } else if (change.type === 'remove') {
      if (!change.lineId) throw new Error('supplement_remove_requires_line_id');
      lines.delete(change.lineId);
    } else {
      if (!change.lineId || !change.line) throw new Error('supplement_replace_requires_line');
      lines.set(change.lineId, change.line);
    }
  }
  return {
    ...estimate,
    lines: [...lines.values()],
    revision: estimate.revision + 1,
    status: 'supplement',
    updatedAt: new Date().toISOString(),
  };
}
