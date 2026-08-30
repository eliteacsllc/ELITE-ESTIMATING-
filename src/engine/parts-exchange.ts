import type { PartCandidate } from './parts-optimizer.js';

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
