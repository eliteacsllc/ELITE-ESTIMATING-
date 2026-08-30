import assert from 'node:assert/strict';
import test from 'node:test';
import { EliteJsonInterchangeAdapter } from './elite-json.js';
import { STANDARD_INTERCHANGE_FORMATS, UniversalInterchangeRegistry } from './universal.js';

function registry(): UniversalInterchangeRegistry {
  const value = new UniversalInterchangeRegistry();
  for (const format of STANDARD_INTERCHANGE_FORMATS) value.register(format, format.id === 'elite-json-v1' ? new EliteJsonInterchangeAdapter() : undefined);
  return value;
}

test('open Elite format is immediately ready', () => {
  assert.equal(registry().activation('elite-json-v1'), 'ready');
});

test('licensed proprietary format fails closed without agreement', () => {
  assert.equal(registry().activation('licensed-ccc'), 'license_required');
});

test('licensed format still requires an implemented adapter after authorization', () => {
  assert.equal(registry().activation('licensed-ccc', new Set(['licensed-ccc'])), 'adapter_required');
});

test('unknown payload cannot bypass authorized adapter requirement', async () => {
  await assert.rejects(() => registry().import('application/octet-stream', new Uint8Array([1,2,3]), new Set()), /interchange_no_authorized_adapter/);
});
