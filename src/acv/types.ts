export type Money = number;

export type VehicleCondition =
  | "excellent"
  | "very_good"
  | "good"
  | "fair"
  | "poor"
  | "salvage";

export type MarketChannel =
  | "retail"
  | "wholesale"
  | "private_party"
  | "collector"
  | "salvage";

export interface VehicleIdentity {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyStyle?: string;
  engine?: string;
  drivetrain?: string;
  transmission?: string;
  fuelType?: string;
  doors?: number;
  options: string[];
}

export interface LossVehicle extends VehicleIdentity {
  mileage: number;
  condition: VehicleCondition;
  postalCode: string;
  state?: string;
  priorDamageDollars?: number;
  refurbishmentsDollars?: number;
  titleBrands?: string[];
  photos?: string[];
}

export interface ComparableVehicle extends VehicleIdentity {
  source: string;
  sourceUrl?: string;
  dealerName?: string;
  postalCode?: string;
  distanceMiles?: number;
  mileage: number;
  askingPrice?: Money;
  soldPrice?: Money;
  observedAt: string;
  condition?: VehicleCondition;
  titleBrands?: string[];
  channel?: Exclude<MarketChannel, "salvage">;
}

export interface SalvageBid {
  source: string;
  bidder?: string;
  amount: Money;
  observedAt: string;
  sourceUrl?: string;
  confidence?: number;
}

export interface GuideValue {
  source: string;
  channel: Exclude<MarketChannel, "salvage">;
  amount: Money;
  observedAt: string;
  methodology?: string;
}

export interface PhotoConditionSignal {
  category:
    | "body"
    | "paint"
    | "glass"
    | "interior"
    | "tires"
    | "mechanical"
    | "prior_damage"
    | "modification";
  severity: 0 | 1 | 2 | 3 | 4;
  confidence: number;
  notes?: string;
}

export interface ComparableAdjustment {
  comparableSource: string;
  basePrice: Money;
  mileage: Money;
  options: Money;
  condition: Money;
  geography: Money;
  history: Money;
  ageFreshness: Money;
  adjustedValue: Money;
  weight: number;
  explanation: string[];
}

export interface ValuationRange {
  low: Money;
  midpoint: Money;
  high: Money;
}

export interface AcvResult {
  identity: VehicleIdentity;
  acv: ValuationRange;
  retail: ValuationRange;
  wholesale: ValuationRange;
  privateParty: ValuationRange;
  collector?: ValuationRange;
  salvage: ValuationRange;
  comparableAdjustments: ComparableAdjustment[];
  salvageBids: SalvageBid[];
  guideValues: GuideValue[];
  photoSignals: PhotoConditionSignal[];
  confidence: number;
  jurisdictionProfile: string;
  evidenceWarnings: string[];
  generatedAt: string;
}
