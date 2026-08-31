import type { PartCandidate } from './parts-optimizer.js';
import { certifyPartsFeed, type PartsFeedConformancePolicy, type PartsFeedConformanceResult } from './parts-feed-conformance.js';

export type PartsFeed = {
  providerId: string;
  retrievedAt: string;
  candidates: PartCandidate[];
};

export type PartsExchangeResult = {
  candidates: PartCandidate[];
  providers: string[];
  collisions: Array<{ key: string; candidateIds: string[] }>;
};

export type CertifiedPartsExchangeResult = PartsExchangeResult & {
  certifications: PartsFeedConformanceResult[];
  rejectedProviders: Array<{ providerId: string; blockers: string[] }>;
};

function normalize(value: string | undefined): string { return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') ?? ''; }

function candidateKey(candidate: PartCandidate): string {
  const number = normalize(candidate.partNumber);
  if (number) return `pn:${number}`;
  return `desc:${candidate.description.trim().toLowerCase()}|${candidate.sourceType}`;
}

export function mergePartsFeeds(feeds: PartsFeed[]): PartsExchangeResult {
  const providers = [...new Set(feeds.map(feed => feed.providerId))].sort();
  const grouped = new Map<string, PartCandidate[]>();
  for (const feed of feeds) {
    for (const candidate of feed.candidates) {
      const key = candidateKey(candidate);
      grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
    }
  }

  const collisions: PartsExchangeResult['collisions'] = [];
  const candidates: PartCandidate[] = [];
  for (const [key, group] of grouped) {
    if (group.length > 1) collisions.push({ key, candidateIds: group.map(candidate => candidate.id).sort() });
    const ordered = [...group].sort((a, b) => {
      const aCost = a.price.amountMinor + (a.shipping?.amountMinor ?? 0);
      const bCost = b.price.amountMinor + (b.shipping?.amountMinor ?? 0);
      return aCost - bCost || (a.leadTimeDays ?? 999) - (b.leadTimeDays ?? 999) || a.id.localeCompare(b.id);
    });
    candidates.push(...ordered);
  }

  candidates.sort((a, b) => candidateKey(a).localeCompare(candidateKey(b)) || a.id.localeCompare(b.id));
  collisions.sort((a, b) => a.key.localeCompare(b.key));
  return { candidates, providers, collisions };
}

export function mergeCertifiedPartsFeeds(
  feeds: PartsFeed[],
  policy: PartsFeedConformancePolicy,
  options: { nowMs?: number; failClosed?: boolean } = {},
): CertifiedPartsExchangeResult {
  const nowMs = options.nowMs ?? Date.now();
  const failClosed = options.failClosed ?? true;
  const certifications = feeds.map(feed => certifyPartsFeed(feed, policy, nowMs));
  const rejectedProviders = certifications
    .filter(result => !result.green)
    .map(result => ({ providerId: result.providerId, blockers: result.blockers }));
  if (failClosed && rejectedProviders.length) {
    throw new Error(`parts_feed_certification_failed:${rejectedProviders.map(item => `${item.providerId}:${item.blockers.join(',')}`).join('|')}`);
  }
  const greenProviders = new Set(certifications.filter(result => result.green).map(result => result.providerId));
  const merged = mergePartsFeeds(feeds.filter(feed => greenProviders.has(feed.providerId)));
  return { ...merged, certifications, rejectedProviders };
}
