import type { PartsFeed } from './parts-exchange.js';

export type PartsFeedConformancePolicy = {
  currency: string;
  maximumAgeMinutes: number;
  requireAvailabilityTimestamp?: boolean;
};

export type PartsFeedConformanceResult = {
  providerId: string;
  green: boolean;
  blockers: string[];
  candidateCount: number;
  ageMinutes: number | null;
};

function validCurrency(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function certifyPartsFeed(feed: PartsFeed, policy: PartsFeedConformancePolicy, nowMs = Date.now()): PartsFeedConformanceResult {
  const blockers: string[] = [];
  if (!feed.providerId.trim()) blockers.push('parts_feed_provider_required');
  if (!validCurrency(policy.currency)) throw new Error('parts_feed_currency_policy_invalid');
  if (!Number.isFinite(policy.maximumAgeMinutes) || policy.maximumAgeMinutes <= 0) throw new Error('parts_feed_age_policy_invalid');

  const retrievedMs = Date.parse(feed.retrievedAt);
  const ageMinutes = Number.isFinite(retrievedMs) ? Math.max(0, (nowMs - retrievedMs) / 60_000) : null;
  if (ageMinutes === null) blockers.push('parts_feed_retrieved_at_invalid');
  else if (ageMinutes > policy.maximumAgeMinutes) blockers.push(`parts_feed_stale:${ageMinutes.toFixed(2)}`);
  if (!feed.candidates.length) blockers.push('parts_feed_candidates_required');

  const ids = new Set<string>();
  for (const candidate of feed.candidates) {
    if (!candidate.id.trim() || ids.has(candidate.id)) blockers.push('parts_candidate_id_invalid');
    ids.add(candidate.id);
    if (!candidate.description.trim()) blockers.push(`parts_description_required:${candidate.id}`);
    if (candidate.price.currency !== policy.currency) blockers.push(`parts_currency_mismatch:${candidate.id}`);
    if (!Number.isSafeInteger(candidate.price.amountMinor) || candidate.price.amountMinor < 0) blockers.push(`parts_price_invalid:${candidate.id}`);
    if (candidate.shipping && (!Number.isSafeInteger(candidate.shipping.amountMinor) || candidate.shipping.amountMinor < 0 || candidate.shipping.currency !== policy.currency)) blockers.push(`parts_shipping_invalid:${candidate.id}`);
    if (candidate.quantityAvailable !== undefined && (!Number.isFinite(candidate.quantityAvailable) || candidate.quantityAvailable < 0)) blockers.push(`parts_availability_invalid:${candidate.id}`);
    if (candidate.leadTimeDays !== undefined && (!Number.isFinite(candidate.leadTimeDays) || candidate.leadTimeDays < 0)) blockers.push(`parts_lead_time_invalid:${candidate.id}`);
    if (!candidate.provenance.length) blockers.push(`parts_provenance_required:${candidate.id}`);
    else if (!candidate.provenance.some(source => source.provider === feed.providerId)) blockers.push(`parts_provider_provenance_mismatch:${candidate.id}`);
    if (candidate.partNumber !== undefined && !candidate.partNumber.trim()) blockers.push(`parts_number_invalid:${candidate.id}`);
    if (policy.requireAvailabilityTimestamp && !candidate.provenance.some(source => Number.isFinite(Date.parse(source.retrievedAt)))) blockers.push(`parts_availability_timestamp_required:${candidate.id}`);
  }

  return { providerId: feed.providerId, green: blockers.length === 0, blockers: [...new Set(blockers)], candidateCount: feed.candidates.length, ageMinutes };
}
