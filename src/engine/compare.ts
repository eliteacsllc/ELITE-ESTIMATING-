import type { Estimate, EstimateLine } from '../domain/types.js';

export type LineDelta = {
  key: string;
  before?: EstimateLine;
  after?: EstimateLine;
  amountDeltaMinor: number;
  kind: 'added' | 'removed' | 'changed' | 'unchanged';
};

function key(line: EstimateLine): string {
  return `${line.category.trim().toLowerCase()}|${line.component.trim().toLowerCase()}|${line.operation}`;
}

export type EstimateComparison = {
  currency: string;
  totalDeltaMinor: number;
  addedMinor: number;
  removedMinor: number;
  changedMinor: number;
  lines: LineDelta[];
};

export function compareEstimates(before: Estimate, after: Estimate): EstimateComparison {
  if (before.currency !== after.currency) throw new Error('comparison_currency_mismatch');
  const beforeMap = new Map(before.lines.map((line) => [key(line), line]));
  const afterMap = new Map(after.lines.map((line) => [key(line), line]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const lines: LineDelta[] = [];
  let addedMinor = 0;
  let removedMinor = 0;
  let changedMinor = 0;

  for (const itemKey of keys) {
    const oldLine = beforeMap.get(itemKey);
    const newLine = afterMap.get(itemKey);
    if (!oldLine && newLine) {
      addedMinor += newLine.total.amountMinor;
      lines.push({ key: itemKey, after: newLine, amountDeltaMinor: newLine.total.amountMinor, kind: 'added' });
      continue;
    }
    if (oldLine && !newLine) {
      removedMinor += oldLine.total.amountMinor;
      lines.push({ key: itemKey, before: oldLine, amountDeltaMinor: -oldLine.total.amountMinor, kind: 'removed' });
      continue;
    }
    if (!oldLine || !newLine) continue;
    const delta = newLine.total.amountMinor - oldLine.total.amountMinor;
    const changed = delta !== 0 || oldLine.quantity !== newLine.quantity || oldLine.laborHours !== newLine.laborHours;
    if (changed) changedMinor += delta;
    lines.push({ key: itemKey, before: oldLine, after: newLine, amountDeltaMinor: delta, kind: changed ? 'changed' : 'unchanged' });
  }

  return {
    currency: before.currency,
    totalDeltaMinor: after.total.amountMinor - before.total.amountMinor,
    addedMinor,
    removedMinor,
    changedMinor,
    lines,
  };
}
