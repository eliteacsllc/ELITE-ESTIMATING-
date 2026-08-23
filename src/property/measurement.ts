export type MeasurementUnit = 'ft' | 'm';

export type Point2D = {
  x: number;
  y: number;
};

export type Opening = {
  width: number;
  height: number;
  quantity?: number;
};

export type RoomMeasurement = {
  unit: MeasurementUnit;
  floorOutline: Point2D[];
  wallHeight: number;
  openings?: Opening[];
};

export type RoomQuantities = {
  unit: MeasurementUnit;
  floorArea: number;
  ceilingArea: number;
  perimeter: number;
  grossWallArea: number;
  openingArea: number;
  netWallArea: number;
  baseboardLength: number;
};

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid_measurement:${name}`);
}

export function polygonArea(points: Point2D[]): number {
  if (points.length < 3) throw new Error('polygon_requires_three_points');
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    if (![current.x, current.y, next.x, next.y].every(Number.isFinite)) throw new Error('invalid_polygon_coordinate');
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: Point2D[]): number {
  if (points.length < 2) throw new Error('polygon_requires_two_points');
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    if (![current.x, current.y, next.x, next.y].every(Number.isFinite)) throw new Error('invalid_polygon_coordinate');
    total += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return total;
}

export function openingArea(openings: Opening[] = []): number {
  return openings.reduce((sum, opening, index) => {
    assertFiniteNonNegative(opening.width, `opening_${index}_width`);
    assertFiniteNonNegative(opening.height, `opening_${index}_height`);
    const quantity = opening.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`invalid_measurement:opening_${index}_quantity`);
    return sum + opening.width * opening.height * quantity;
  }, 0);
}

export function roomQuantities(room: RoomMeasurement): RoomQuantities {
  assertFiniteNonNegative(room.wallHeight, 'wall_height');
  const floorArea = polygonArea(room.floorOutline);
  const perimeter = polygonPerimeter(room.floorOutline);
  const grossWallArea = perimeter * room.wallHeight;
  const deductions = openingArea(room.openings);
  if (deductions > grossWallArea) throw new Error('opening_area_exceeds_wall_area');
  return {
    unit: room.unit,
    floorArea,
    ceilingArea: floorArea,
    perimeter,
    grossWallArea,
    openingArea: deductions,
    netWallArea: grossWallArea - deductions,
    baseboardLength: perimeter,
  };
}

export function roofSlopeFactor(rise: number, run: number): number {
  assertFiniteNonNegative(rise, 'roof_rise');
  if (!Number.isFinite(run) || run <= 0) throw new Error('invalid_measurement:roof_run');
  return Math.sqrt(1 + (rise / run) ** 2);
}

export function slopedArea(planArea: number, rise: number, run: number): number {
  assertFiniteNonNegative(planArea, 'plan_area');
  return planArea * roofSlopeFactor(rise, run);
}

export function convertLength(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (!Number.isFinite(value)) throw new Error('invalid_measurement:length');
  if (from === to) return value;
  return from === 'ft' ? value * 0.3048 : value / 0.3048;
}

export function convertArea(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (!Number.isFinite(value)) throw new Error('invalid_measurement:area');
  if (from === to) return value;
  const factor = 0.3048 ** 2;
  return from === 'ft' ? value * factor : value / factor;
}
