import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArea, convertLength, polygonArea, polygonPerimeter, roofSlopeFactor, roomQuantities, slopedArea } from './measurement.js';

const rectangle = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 0, y: 10 }];

test('polygon measurement calculates rectangular area and perimeter', () => {
  assert.equal(polygonArea(rectangle), 120);
  assert.equal(polygonPerimeter(rectangle), 44);
});

test('room quantities deduct openings from wall area', () => {
  const result = roomQuantities({
    unit: 'ft',
    floorOutline: rectangle,
    wallHeight: 8,
    openings: [{ width: 3, height: 7 }, { width: 4, height: 3, quantity: 2 }],
  });
  assert.equal(result.floorArea, 120);
  assert.equal(result.ceilingArea, 120);
  assert.equal(result.grossWallArea, 352);
  assert.equal(result.openingArea, 45);
  assert.equal(result.netWallArea, 307);
  assert.equal(result.baseboardLength, 44);
});

test('roof slope converts plan area to sloped surface area', () => {
  assert.ok(Math.abs(roofSlopeFactor(6, 12) - Math.sqrt(1.25)) < 1e-12);
  assert.ok(Math.abs(slopedArea(100, 6, 12) - 111.80339887498948) < 1e-9);
});

test('imperial and metric conversions are reversible', () => {
  const metres = convertLength(10, 'ft', 'm');
  assert.ok(Math.abs(convertLength(metres, 'm', 'ft') - 10) < 1e-12);
  const squareMetres = convertArea(100, 'ft', 'm');
  assert.ok(Math.abs(convertArea(squareMetres, 'm', 'ft') - 100) < 1e-10);
});

test('impossible opening deductions are rejected', () => {
  assert.throws(() => roomQuantities({
    unit: 'ft',
    floorOutline: rectangle,
    wallHeight: 1,
    openings: [{ width: 20, height: 20 }],
  }), /opening_area_exceeds_wall_area/);
});
