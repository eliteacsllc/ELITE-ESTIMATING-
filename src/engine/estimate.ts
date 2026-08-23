import type { EstimateLine, Money } from '../domain/types.js';

function assertSameCurrency(values: Money[]): string {
  const currencies = new Set(values.map((value) => value.currency));
  if (currencies.size !== 1) throw new Error('Mixed currencies require explicit FX normalization before calculation.');
  const currency = values[0]?.currency;
  if (!currency) throw new Error('At least one monetary value is required.');
  return currency;
}

export function lineTotal(line: Omit<EstimateLine, 'total'>): Money {
  const values = [line.laborRate, line.partOrMaterial, line.equipment, line.tax].filter((value): value is Money => Boolean(value));
  if (values.length === 0) return { amountMinor: 0, currency: 'USD' };
  const currency = assertSameCurrency(values);
  const labor = line.laborRate ? Math.round((line.laborHours ?? 0) * line.laborRate.amountMinor) : 0;
  const partOrMaterial = line.partOrMaterial ? Math.round(line.partOrMaterial.amountMinor * line.quantity) : 0;
  const equipment = line.equipment ? Math.round(line.equipment.amountMinor * line.quantity) : 0;
  const tax = line.tax?.amountMinor ?? 0;
  return { amountMinor: labor + partOrMaterial + equipment + tax, currency };
}

export function validateSafetyEvidence(line: EstimateLine): string[] {
  const errors: string[] = [];
  if (line.safetyCritical && (!line.procedureRefs || line.procedureRefs.length === 0)) {
    errors.push(`Safety-critical line ${line.id} requires at least one procedure reference.`);
  }
  if (line.aiSuggested && line.aiConfidence === undefined) {
    errors.push(`AI-suggested line ${line.id} requires confidence.`);
  }
  if (line.aiConfidence !== undefined && (line.aiConfidence < 0 || line.aiConfidence > 1)) {
    errors.push(`AI confidence for line ${line.id} must be between 0 and 1.`);
  }
  if (line.provenance.length === 0) {
    errors.push(`Estimate line ${line.id} requires provenance.`);
  }
  return errors;
}

export function auditEstimateLines(lines: EstimateLine[]): string[] {
  const errors = lines.flatMap(validateSafetyEvidence);
  const ids = new Set<string>();
  for (const line of lines) {
    if (ids.has(line.id)) errors.push(`Duplicate estimate line id: ${line.id}`);
    ids.add(line.id);
    if (line.quantity < 0) errors.push(`Negative quantity on line ${line.id}.`);
    if ((line.laborHours ?? 0) < 0) errors.push(`Negative labor hours on line ${line.id}.`);
  }
  return errors;
}
