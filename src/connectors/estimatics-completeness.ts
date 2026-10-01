import type { Estimate } from '../domain/types.js';
import { buildEstimateCompletenessReview } from '../intelligence/estimate-completeness.js';
import type { EstimaticsQuery } from './estimatics-client.js';

const KIND_MAP: Array<[RegExp,string[]]> = [
  [/scan|diagnostic/i,['diagnostic','scan']],
  [/calibrat|adas/i,['adas','calibration']],
  [/structur|measure|section|weld/i,['structural','measurement','sectioning']],
  [/corrosion|refinish/i,['corrosion_protection','refinish']],
];

export function buildEstimaticsCompletenessQuery(estimate: Estimate): EstimaticsQuery {
  const { year, make, model, vin, jurisdiction, attributes } = estimate.asset;
  if (!year || !make?.trim()) throw new Error('estimatics_vehicle_identity_incomplete');
  const review = buildEstimateCompletenessReview(estimate);
  const kinds = new Set<string>();
  for (const candidate of review.candidates) {
    const text = `${candidate.code} ${candidate.title} ${candidate.reason}`;
    for (const [pattern, mapped] of KIND_MAP) if (pattern.test(text)) mapped.forEach(kind => kinds.add(kind));
  }
  if (!kinds.size) ['repair_procedure','included_not_included'].forEach(kind => kinds.add(kind));
  const trim = typeof attributes?.trim === 'string' ? attributes.trim : undefined;
  const engine = typeof attributes?.engine === 'string' ? attributes.engine : undefined;
  return {
    year,
    make: make.trim(),
    ...(model?.trim() ? { model: model.trim() } : {}),
    ...(trim ? { trim } : {}),
    ...(engine ? { engine } : {}),
    ...(vin?.trim() ? { vin: vin.trim() } : {}),
    ...(jurisdiction?.trim() ? { region: jurisdiction.trim() } : {}),
    kinds: [...kinds].sort(),
  };
}
