import type { SubjectVehicle } from './market-valuation.js';

export type ValuationAssetClass = 'passenger_auto' | 'motorcycle' | 'rv' | 'heavy_equipment';

export type MultiAssetSubject = SubjectVehicle & {
  assetClass: ValuationAssetClass;
  manufacturer?: string;
  series?: string;
  hours?: number;
};

export type AssetSearchPolicy = {
  initialRadiusMiles: number;
  maxRadiusMiles: number;
  targetComparableCount: number;
  mileageMetric: 'miles' | 'hours';
  requireSerialOrVin: boolean;
};

const POLICIES: Record<ValuationAssetClass, AssetSearchPolicy> = {
  passenger_auto: { initialRadiusMiles: 25, maxRadiusMiles: 500, targetComparableCount: 6, mileageMetric: 'miles', requireSerialOrVin: true },
  motorcycle: { initialRadiusMiles: 50, maxRadiusMiles: 750, targetComparableCount: 5, mileageMetric: 'miles', requireSerialOrVin: true },
  rv: { initialRadiusMiles: 100, maxRadiusMiles: 1500, targetComparableCount: 4, mileageMetric: 'miles', requireSerialOrVin: true },
  heavy_equipment: { initialRadiusMiles: 150, maxRadiusMiles: 2500, targetComparableCount: 4, mileageMetric: 'hours', requireSerialOrVin: true },
};

export function assetSearchPolicy(assetClass: ValuationAssetClass): AssetSearchPolicy {
  const policy = POLICIES[assetClass];
  if (!policy) throw new Error('unsupported_valuation_asset_class');
  return { ...policy };
}

export function normalizeMultiAssetSubject(subject: MultiAssetSubject): SubjectVehicle {
  if (!subject?.assetClass) throw new Error('asset_class_required');
  assetSearchPolicy(subject.assetClass);
  return {
    year: subject.year,
    make: subject.make ?? subject.manufacturer,
    model: subject.model ?? subject.series,
    trim: subject.trim,
    mileage: subject.assetClass === 'heavy_equipment' ? subject.hours : subject.mileage,
    options: subject.options,
    equipment: subject.equipment,
  };
}
