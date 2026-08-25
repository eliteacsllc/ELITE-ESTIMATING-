import type { Money, SourceProvenance } from '../domain/types.js';
import { normalizePrices, type PriceObservation } from './pricing.js';

export type ValuationComparable = {
  id: string;
  adjustedValue: Money;
  mileage?: number;
  distanceMiles?: number;
  observedAt: string;
  provenance: SourceProvenance;
};

export type TotalLossPolicy =
  | { method: 'threshold'; thresholdRatio: number }
  | { method: 'formula' };

export type TotalLossInput = {
  currency: string;
  repairCost: Money;
  salvageValue: Money;
  taxesAndFees?: Money;
  comparableValues: ValuationComparable[];
  policy: TotalLossPolicy;
  jurisdictionReference?: string;
};

export type TotalLossAnalysis = {
  recommendation: 'repairable_economically' | 'total_loss_indicator' | 'manual_review';
  actualCashValue: Money;
  valuationLow: Money;
  valuationHigh: Money;
  repairCost: Money;
  salvageValue: Money;
  thresholdAmount?: Money;
  economicFormulaAmount: Money;
  repairToValueRatio: number;
  confidence: number;
  reasons: string[];
  warnings: string[];
  provenance: SourceProvenance[];
};

function assertCurrency(currency: string, values: Array<Money | undefined>): void {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('total_loss_currency_invalid');
  for (const value of values) if (value && value.currency !== currency) throw new Error('total_loss_currency_mismatch');
}

export function analyzeTotalLoss(input: TotalLossInput): TotalLossAnalysis {
  assertCurrency(input.currency, [input.repairCost, input.salvageValue, input.taxesAndFees, ...input.comparableValues.map(item => item.adjustedValue)]);
  if (input.repairCost.amountMinor < 0 || input.salvageValue.amountMinor < 0) throw new Error('total_loss_negative_value');
  if (input.comparableValues.length === 0) throw new Error('total_loss_comparables_required');
  if (input.policy.method === 'threshold' && (!Number.isFinite(input.policy.thresholdRatio) || input.policy.thresholdRatio <= 0 || input.policy.thresholdRatio > 1.5)) throw new Error('total_loss_threshold_invalid');

  const observations: PriceObservation[] = input.comparableValues.map(item => ({ price: item.adjustedValue, observedAt: item.observedAt, provenance: item.provenance }));
  const valuation = normalizePrices(observations);
  const acvMinor = valuation.price.amountMinor + (input.taxesAndFees?.amountMinor ?? 0);
  if (acvMinor <= 0) throw new Error('total_loss_acv_invalid');
  const repairRatio = input.repairCost.amountMinor / acvMinor;
  const formulaAmount = input.repairCost.amountMinor + input.salvageValue.amountMinor;
  const warnings: string[] = [];
  const reasons: string[] = [
    `acv:${acvMinor}`,
    `repair_cost:${input.repairCost.amountMinor}`,
    `salvage_value:${input.salvageValue.amountMinor}`,
    `repair_to_value_ratio:${repairRatio.toFixed(4)}`,
  ];

  let recommendation: TotalLossAnalysis['recommendation'];
  let thresholdAmount: Money | undefined;
  if (input.policy.method === 'threshold') {
    const thresholdMinor = Math.round(acvMinor * input.policy.thresholdRatio);
    thresholdAmount = { amountMinor: thresholdMinor, currency: input.currency };
    reasons.push(`threshold_ratio:${input.policy.thresholdRatio}`, `threshold_amount:${thresholdMinor}`);
    recommendation = input.repairCost.amountMinor >= thresholdMinor ? 'total_loss_indicator' : 'repairable_economically';
  } else {
    reasons.push(`formula_repair_plus_salvage:${formulaAmount}`);
    recommendation = formulaAmount >= acvMinor ? 'total_loss_indicator' : 'repairable_economically';
  }

  if (!input.jurisdictionReference?.trim()) {
    warnings.push('jurisdiction_rule_reference_required_for_legal_determination');
    recommendation = 'manual_review';
  }
  if (valuation.confidence < 0.65) warnings.push('valuation_confidence_low');
  if (input.comparableValues.length < 3) warnings.push('limited_comparable_sample');
  const confidence = Number(Math.min(0.98, valuation.confidence * (input.jurisdictionReference ? 1 : 0.7)).toFixed(2));

  return {
    recommendation,
    actualCashValue: { amountMinor: acvMinor, currency: input.currency },
    valuationLow: { amountMinor: valuation.low.amountMinor + (input.taxesAndFees?.amountMinor ?? 0), currency: input.currency },
    valuationHigh: { amountMinor: valuation.high.amountMinor + (input.taxesAndFees?.amountMinor ?? 0), currency: input.currency },
    repairCost: input.repairCost,
    salvageValue: input.salvageValue,
    ...(thresholdAmount ? { thresholdAmount } : {}),
    economicFormulaAmount: { amountMinor: formulaAmount, currency: input.currency },
    repairToValueRatio: Number(repairRatio.toFixed(4)),
    confidence,
    reasons,
    warnings,
    provenance: valuation.sources,
  };
}
