import type {
  AcvResult,
  ComparableAdjustment,
  ComparableVehicle,
  GuideValue,
  LossVehicle,
  Money,
  PhotoConditionSignal,
  SalvageBid,
  ValuationRange,
  VehicleCondition,
} from "./types.js";

const CONDITION_FACTOR: Record<VehicleCondition, number> = {
  excellent: 0.05,
  very_good: 0.025,
  good: 0,
  fair: -0.06,
  poor: -0.16,
  salvage: -0.65,
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rangeFrom(values: number[], fallback = 0): ValuationRange {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!clean.length) return { low: fallback, midpoint: fallback, high: fallback };
  const mid = median(clean);
  const spread = clean.length > 1 ? Math.max(mid - clean[0]!, clean[clean.length - 1]! - mid) : mid * 0.06;
  return {
    low: Math.round(Math.max(0, mid - spread)),
    midpoint: Math.round(mid),
    high: Math.round(mid + spread),
  };
}

function mileageAdjustment(loss: LossVehicle, comp: ComparableVehicle, base: number): number {
  const delta = comp.mileage - loss.mileage;
  const age = Math.max(1, new Date().getUTCFullYear() - (loss.year ?? new Date().getUTCFullYear()));
  const centsPerMile = clamp(0.045 + age * 0.004, 0.04, 0.13);
  return Math.round(delta * centsPerMile);
}

function optionAdjustment(loss: LossVehicle, comp: ComparableVehicle, base: number): number {
  const lossSet = new Set(loss.options.map((option) => option.toLowerCase()));
  const compSet = new Set(comp.options.map((option) => option.toLowerCase()));
  let score = 0;
  for (const option of lossSet) if (!compSet.has(option)) score += 1;
  for (const option of compSet) if (!lossSet.has(option)) score -= 0.6;
  return Math.round(base * clamp(score * 0.0075, -0.08, 0.12));
}

function conditionAdjustment(loss: LossVehicle, comp: ComparableVehicle, base: number): number {
  const compFactor = CONDITION_FACTOR[comp.condition ?? "good"];
  return Math.round(base * (CONDITION_FACTOR[loss.condition] - compFactor));
}

function geographyAdjustment(comp: ComparableVehicle, base: number): number {
  const distance = comp.distanceMiles ?? 0;
  if (distance <= 75) return 0;
  if (distance <= 150) return Math.round(base * -0.005);
  if (distance <= 300) return Math.round(base * -0.0125);
  return Math.round(base * -0.025);
}

function historyAdjustment(loss: LossVehicle, comp: ComparableVehicle, base: number): number {
  const lossBrands = loss.titleBrands?.length ?? 0;
  const compBrands = comp.titleBrands?.length ?? 0;
  const priorDamage = loss.priorDamageDollars ?? 0;
  return Math.round(base * clamp((compBrands - lossBrands) * 0.08, -0.25, 0.25) - priorDamage * 0.35);
}

function freshnessAdjustment(comp: ComparableVehicle, base: number): number {
  const days = Math.max(0, (Date.now() - new Date(comp.observedAt).getTime()) / 86_400_000);
  return days <= 30 ? 0 : Math.round(base * -clamp((days - 30) / 3650, 0, 0.06));
}

function scoreComparable(loss: LossVehicle, comp: ComparableVehicle): number {
  let score = 1;
  if (loss.make && comp.make && loss.make.toLowerCase() !== comp.make.toLowerCase()) score *= 0.05;
  if (loss.model && comp.model && loss.model.toLowerCase() !== comp.model.toLowerCase()) score *= 0.1;
  if (loss.year && comp.year) score *= Math.max(0.15, 1 - Math.abs(loss.year - comp.year) * 0.22);
  if (loss.trim && comp.trim && loss.trim.toLowerCase() !== comp.trim.toLowerCase()) score *= 0.72;
  const mileageTolerance = Math.max(4_000, loss.mileage * 0.1);
  score *= Math.max(0.2, 1 - Math.abs(loss.mileage - comp.mileage) / Math.max(mileageTolerance * 4, 1));
  if ((comp.distanceMiles ?? 0) > 300) score *= 0.75;
  return clamp(score, 0.01, 1);
}

export function adjustComparable(loss: LossVehicle, comp: ComparableVehicle): ComparableAdjustment | null {
  const base = comp.soldPrice ?? comp.askingPrice;
  if (!base || base <= 0) return null;
  const mileage = mileageAdjustment(loss, comp, base);
  const options = optionAdjustment(loss, comp, base);
  const condition = conditionAdjustment(loss, comp, base);
  const geography = geographyAdjustment(comp, base);
  const history = historyAdjustment(loss, comp, base);
  const ageFreshness = freshnessAdjustment(comp, base);
  const adjustedValue = Math.max(0, Math.round(base + mileage + options + condition + geography + history + ageFreshness));
  const weight = scoreComparable(loss, comp);
  return {
    comparableSource: comp.source,
    basePrice: base,
    mileage,
    options,
    condition,
    geography,
    history,
    ageFreshness,
    adjustedValue,
    weight,
    explanation: [
      `Comparable match weight ${weight.toFixed(2)}`,
      `Mileage adjustment ${mileage >= 0 ? "+" : ""}${mileage}`,
      `Options adjustment ${options >= 0 ? "+" : ""}${options}`,
      `Condition adjustment ${condition >= 0 ? "+" : ""}${condition}`,
    ],
  };
}

function weightedMarket(adjustments: ComparableAdjustment[]): number {
  const usable = adjustments.filter((item) => item.weight >= 0.2 && item.adjustedValue > 0);
  const denominator = usable.reduce((sum, item) => sum + item.weight, 0);
  if (!denominator) return 0;
  return usable.reduce((sum, item) => sum + item.adjustedValue * item.weight, 0) / denominator;
}

function guideChannel(guides: GuideValue[], channel: GuideValue["channel"]): number[] {
  return guides.filter((guide) => guide.channel === channel).map((guide) => guide.amount);
}

function photoConditionDelta(signals: PhotoConditionSignal[], base: number): number {
  const weighted = signals.reduce((sum, signal) => sum + signal.severity * signal.confidence, 0);
  const confidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) || 1;
  const averageSeverity = weighted / confidence;
  return Math.round(base * clamp(-averageSeverity * 0.018, -0.16, 0));
}

export function calculateAcv(input: {
  loss: LossVehicle;
  comparables: ComparableVehicle[];
  guideValues?: GuideValue[];
  salvageBids?: SalvageBid[];
  photoSignals?: PhotoConditionSignal[];
  jurisdictionProfile?: string;
}): AcvResult {
  const guideValues = input.guideValues ?? [];
  const salvageBids = input.salvageBids ?? [];
  const photoSignals = input.photoSignals ?? [];
  const adjustments = input.comparables.map((comp) => adjustComparable(input.loss, comp)).filter(Boolean) as ComparableAdjustment[];
  const market = weightedMarket(adjustments);
  const retailGuides = guideChannel(guideValues, "retail");
  const retailBase = median([market, ...retailGuides].filter((value) => value > 0));
  const photoDelta = retailBase ? photoConditionDelta(photoSignals, retailBase) : 0;
  const refurbishment = input.loss.refurbishmentsDollars ? Math.min(input.loss.refurbishmentsDollars * 0.35, retailBase * 0.08) : 0;
  const acvMid = Math.max(0, retailBase + photoDelta + refurbishment);

  const comparableValues = adjustments.filter((item) => item.weight >= 0.2).map((item) => item.adjustedValue);
  const retail = rangeFrom([...comparableValues, ...retailGuides], acvMid);
  const wholesale = rangeFrom(guideChannel(guideValues, "wholesale"), Math.round(acvMid * 0.84));
  const privateParty = rangeFrom(guideChannel(guideValues, "private_party"), Math.round(acvMid * 0.93));
  const collectorValues = guideChannel(guideValues, "collector");
  const salvage = rangeFrom(salvageBids.map((bid) => bid.amount), Math.round(acvMid * 0.18));
  const evidenceCount = adjustments.filter((item) => item.weight >= 0.5).length + guideValues.length + salvageBids.length;
  const confidence = clamp(0.3 + Math.min(evidenceCount, 10) * 0.055 + Math.min(photoSignals.length, 6) * 0.02, 0.3, 0.97);
  const warnings: string[] = [];
  if (!adjustments.length) warnings.push("No market comparables were available; ACV relies on guide/fallback evidence.");
  if (adjustments.filter((item) => item.weight >= 0.5).length < 3) warnings.push("Fewer than three strong comparables were available.");
  if (!guideValues.length) warnings.push("No licensed guide values were supplied.");
  if (!salvageBids.length) warnings.push("No live salvage bids were supplied; salvage range is a heuristic only.");
  if (!photoSignals.length) warnings.push("No photo-based condition evidence was supplied.");

  return {
    identity: input.loss,
    acv: { low: Math.round(acvMid * 0.96), midpoint: Math.round(acvMid), high: Math.round(acvMid * 1.04) },
    retail,
    wholesale,
    privateParty,
    collector: collectorValues.length ? rangeFrom(collectorValues) : undefined,
    salvage,
    comparableAdjustments: adjustments.sort((a, b) => b.weight - a.weight),
    salvageBids,
    guideValues,
    photoSignals,
    confidence,
    jurisdictionProfile: input.jurisdictionProfile ?? "US_DEFAULT",
    evidenceWarnings: warnings,
    generatedAt: new Date().toISOString(),
  };
}
