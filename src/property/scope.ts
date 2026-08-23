import type { MeasurementUnit, RoomMeasurement } from './measurement.js';
import { roomQuantities, slopedArea } from './measurement.js';

export type PropertyScopeQuantity = {
  code: 'floor' | 'ceiling' | 'wall' | 'baseboard' | 'roof';
  description: string;
  quantity: number;
  unit: 'sq_ft' | 'sq_m' | 'lin_ft' | 'lin_m';
};

function areaUnit(unit: MeasurementUnit): 'sq_ft' | 'sq_m' {
  return unit === 'ft' ? 'sq_ft' : 'sq_m';
}

function lengthUnit(unit: MeasurementUnit): 'lin_ft' | 'lin_m' {
  return unit === 'ft' ? 'lin_ft' : 'lin_m';
}

export function roomScope(room: RoomMeasurement): PropertyScopeQuantity[] {
  const q = roomQuantities(room);
  return [
    { code: 'floor', description: 'Floor area', quantity: q.floorArea, unit: areaUnit(room.unit) },
    { code: 'ceiling', description: 'Ceiling area', quantity: q.ceilingArea, unit: areaUnit(room.unit) },
    { code: 'wall', description: 'Net wall area after openings', quantity: q.netWallArea, unit: areaUnit(room.unit) },
    { code: 'baseboard', description: 'Baseboard / perimeter', quantity: q.baseboardLength, unit: lengthUnit(room.unit) },
  ];
}

export function roofScope(input: { unit: MeasurementUnit; planArea: number; rise: number; run: number }): PropertyScopeQuantity {
  return {
    code: 'roof',
    description: `Roof surface area (${input.rise}:${input.run} slope)`,
    quantity: slopedArea(input.planArea, input.rise, input.run),
    unit: areaUnit(input.unit),
  };
}
