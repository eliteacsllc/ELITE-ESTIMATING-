import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidenceInput } from './types.js';

const base = {
  sourceSystem: 'veh-photo-labeler',
  sourceAssetId: 'photo-1',
  kind: 'photo' as const,
  mimeType: 'image/jpeg',
  sha256: 'a'.repeat(64),
  storageKey: 'tenant-a/estimate-a/photo-1.jpg',
  metadata: {},
  provenance: [{ provider: 'veh-photo-labeler', retrievedAt: '2026-08-23T00:00:00.000Z', licenseClass: 'customer_provided' as const }],
};

test('valid evidence reference passes integrity validation', () => {
  assert.deepEqual(validateEvidenceInput(base), []);
});

test('evidence rejects bad hash and unsafe storage traversal', () => {
  const errors = validateEvidenceInput({ ...base, sha256: 'bad', storageKey: '../secret' });
  assert.ok(errors.includes('invalid_sha256'));
  assert.ok(errors.includes('unsafe_storage_key'));
});

test('evidence requires provenance', () => {
  assert.ok(validateEvidenceInput({ ...base, provenance: [] }).includes('evidence_provenance_required'));
});
