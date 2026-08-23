import test from 'node:test';
import assert from 'node:assert/strict';
import { roofScope, roomScope } from './scope.js';

test('room scope exposes floor ceiling wall and baseboard quantities', () => {
  const scope = roomScope({
    unit: 'ft',
    floorOutline: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    wallHeight: 8,
    openings: [{ width: 3, height: 7 }],
  });
  const byCode = new Map(scope.map(row => [row.code, row]));
  assert.equal(byCode.get('floor')?.quantity, 100);
  assert.equal(byCode.get('ceiling')?.quantity, 100);
  assert.equal(byCode.get('wall')?.quantity, 299);
  assert.equal(byCode.get('baseboard')?.quantity, 40);
  assert.equal(byCode.get('wall')?.unit, 'sq_ft');
});

test('roof scope applies slope factor and preserves measurement system', () => {
  const roof = roofScope({ unit: 'm', planArea: 100, rise: 4, run: 12 });
  assert.equal(roof.unit, 'sq_m');
  assert.ok(roof.quantity > 100);
});
