import type { Money, SourceProvenance } from '../domain/types.js';

export type PartSourceType = 'new_oem' | 'aftermarket' | 'recycled' | 'remanufactured' | 'reconditioned' | 'dealer_quote' | 'other';

export type PartCandidate = {
  id: string;
  description: string;
  sourceType: PartSourceType;
  partNumber?: string;
  supersedes?: string[];
  price: Money;
  shipping?: Money;
  leadTimeDays?: number;
  distanceMiles?: number;
  quantityAvailable?: number;
  conditionGrade?: string;
  certification?: string;
  warrantyMonths?: number;
  carrierAllowed?: boolean;
  oemProcedureCompatible?: boolean;
  safetyCriticalApproved?: boolean;
  provenance: SourceProvenance[];
};

export type PartsOptimizationPolicy = {
  currency: string;
  allowedSourceTypes: PartSourceType[];
  maxLeadTimeDays?: number;
  maxDistanceMiles?: number;
  requireCarrierAllowed?: boolean;
  requireOemProcedureCompatibility?: boolean;
  requireSafetyApproval?: boolean;
  costWeight?: number;
  availabilityWeight?: number;
  qualityWeight?: number;
  logisticsWeight?: number;
};

export type RankedPartCandidate = PartCandidate & {
  landedCost: Money;
  score: number;
  rankReasons: string[];
};

export type PartsOptimizationResult = {
  selected: RankedPartCandidate | null;
  ranked: RankedPartCandidate[];
  rejected: Array<{ candidateId: string; reasons: string[] }>;
};

function moneyTotal(candidate: PartCandidate): number {
  if (candidate.shipping && candidate.shipping.currency !== candidate.price.currency) throw new Error(`parts_currency_mismatch:${candidate.id}`);
  return candidate.price.amountMinor + (candidate.shipping?.amountMinor ?? 0);
}

function clampWeight(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0 || value > 10) throw new Error('parts_invalid_weight');
  return value;
}

export function optimizeParts(candidates: PartCandidate[], policy: PartsOptimizationPolicy): PartsOptimizationResult {
  if (!/^[A-Z]{3}$/.test(policy.currency)) throw new Error('parts_currency_invalid');
  if (policy.allowedSourceTypes.length === 0) throw new Error('parts_allowed_sources_required');
  const rejected: PartsOptimizationResult['rejected'] = [];
  const eligible: PartCandidate[] = [];

  for (const candidate of candidates) {
    const reasons: string[] = [];
    if (candidate.price.currency !== policy.currency) reasons.push('currency_mismatch');
    if (!policy.allowedSourceTypes.includes(candidate.sourceType)) reasons.push('source_type_not_allowed');
    if (policy.maxLeadTimeDays !== undefined && (candidate.leadTimeDays ?? Number.POSITIVE_INFINITY) > policy.maxLeadTimeDays) reasons.push('lead_time_exceeded');
    if (policy.maxDistanceMiles !== undefined && (candidate.distanceMiles ?? Number.POSITIVE_INFINITY) > policy.maxDistanceMiles) reasons.push('distance_exceeded');
    if (policy.requireCarrierAllowed && candidate.carrierAllowed !== true) reasons.push('carrier_not_approved');
    if (policy.requireOemProcedureCompatibility && candidate.oemProcedureCompatible !== true) reasons.push('oem_procedure_compatibility_unverified');
    if (policy.requireSafetyApproval && candidate.safetyCriticalApproved !== true) reasons.push('safety_approval_required');
    if (candidate.provenance.length === 0) reasons.push('provenance_required');
    if (candidate.quantityAvailable !== undefined && candidate.quantityAvailable <= 0) reasons.push('not_available');
    if (reasons.length) rejected.push({ candidateId: candidate.id, reasons });
    else eligible.push(candidate);
  }

  if (eligible.length === 0) return { selected: null, ranked: [], rejected };

  const landedCosts = eligible.map(moneyTotal);
  const minCost = Math.min(...landedCosts);
  const maxCost = Math.max(...landedCosts);
  const costRange = Math.max(1, maxCost - minCost);
  const costWeight = clampWeight(policy.costWeight, 0.45);
  const availabilityWeight = clampWeight(policy.availabilityWeight, 0.25);
  const qualityWeight = clampWeight(policy.qualityWeight, 0.20);
  const logisticsWeight = clampWeight(policy.logisticsWeight, 0.10);
  const totalWeight = costWeight + availabilityWeight + qualityWeight + logisticsWeight;
  if (totalWeight <= 0) throw new Error('parts_weight_total_required');

  const ranked = eligible.map((candidate): RankedPartCandidate => {
    const landed = moneyTotal(candidate);
    const costScore = 1 - ((landed - minCost) / costRange);
    const lead = candidate.leadTimeDays ?? 30;
    const availabilityScore = Math.max(0, 1 - Math.min(30, lead) / 30);
    const warrantyScore = Math.min(1, (candidate.warrantyMonths ?? 0) / 36);
    const certificationScore = candidate.certification ? 1 : candidate.sourceType === 'new_oem' ? 1 : 0.5;
    const compatibilityScore = candidate.oemProcedureCompatible === true ? 1 : candidate.oemProcedureCompatible === false ? 0 : 0.5;
    const qualityScore = (warrantyScore + certificationScore + compatibilityScore) / 3;
    const distance = candidate.distanceMiles ?? 500;
    const logisticsScore = Math.max(0, 1 - Math.min(500, distance) / 500);
    const raw = (costScore * costWeight + availabilityScore * availabilityWeight + qualityScore * qualityWeight + logisticsScore * logisticsWeight) / totalWeight;
    const rankReasons = [
      `landed_cost:${landed}`,
      `lead_time_days:${candidate.leadTimeDays ?? 'unknown'}`,
      `source_type:${candidate.sourceType}`,
      `quality_basis:${candidate.certification ?? candidate.conditionGrade ?? 'unverified'}`,
    ];
    return { ...candidate, landedCost: { amountMinor: landed, currency: policy.currency }, score: Number(raw.toFixed(4)), rankReasons };
  }).sort((a, b) => b.score - a.score || a.landedCost.amountMinor - b.landedCost.amountMinor || a.id.localeCompare(b.id));

  return { selected: ranked[0] ?? null, ranked, rejected };
}
