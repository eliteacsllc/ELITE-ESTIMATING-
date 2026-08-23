import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUpdatedAt } from './versioning.js';

test('nextUpdatedAt advances at least one millisecond when clock has not advanced', () => {
  assert.equal(
    nextUpdatedAt('2026-08-23T15:00:00.000Z', Date.parse('2026-08-23T15:00:00.000Z')),
    '2026-08-23T15:00:00.001Z',
  );
});

test('nextUpdatedAt uses the current clock when it is later', () => {
  assert.equal(
    nextUpdatedAt('2026-08-23T15:00:00.000Z', Date.parse('2026-08-23T15:00:01.500Z')),
    '2026-08-23T15:00:01.500Z',
  );
});
