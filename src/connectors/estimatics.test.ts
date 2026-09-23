import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessEstimaticsEnvelope,
  estimaticsEnvelopeToProviderRecords,
  validateEstimaticsEnvelope,
} from './estimatics.js';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'elite.repair-knowledge.v1',
    consumer: 'elite-estimating',
    tenant_id: 'tenant-a',
    request_id: 'req-1',
    query: { year: 2024, make: 'Example' },
    items: [{
      record_id: 'r1',
      kind: 'procedure',
      title: 'Reference',
      fingerprint: 'fingerprint',
      safety_domains: ['general'],
      status: 'approved_reference_not_repair_authorization',
      citations: [{
        source_id: 'source1',
        document_version: 'v1',
        content_hash: 'hash',
        retrieved_at: '2026-09-19T15:00:00+00:00',
        license_class: 'public',
        effective_to: null,
      }],
    }],
    blocked_record_ids: [],
    warnings: [],
    source_receipt_digest: 'receipt',
    failure_mode: 'fail_closed',
    requires_human_review: false,
    envelope_digest: 'envelope',
    ...overrides,
  };
}

test('accepts tenant-bound Estimatics envelope and converts provenance', () => {
  const records = estimaticsEnvelopeToProviderRecords(envelope(), 'tenant-a');
  assert.equal(records.length, 1);
  assert.equal(records[0]?.provenance.provider, 'elite-estimatics');
  assert.equal(records[0]?.provenance.licenseClass, 'public');
});

test('rejects cross-tenant and wrong-consumer envelopes', () => {
  assert.throws(() => validateEstimaticsEnvelope(envelope(), 'tenant-b'), /tenant_mismatch/);
  assert.throws(() => validateEstimaticsEnvelope(envelope({ consumer: 'damage-iq' }), 'tenant-a'), /consumer_mismatch/);
});

test('rejects non-exportable source classes and incomplete provenance', () => {
  const bad = envelope();
  bad.items[0]!.citations[0]!.license_class = 'licensed_internal';
  assert.throws(() => validateEstimaticsEnvelope(bad, 'tenant-a'), /non_exportable/);
  const missing = envelope();
  missing.items[0]!.citations[0]!.retrieved_at = '';
  assert.throws(() => validateEstimaticsEnvelope(missing, 'tenant-a'), /retrieved_at/);
});

test('fails automation closed when human review or blocked knowledge exists', () => {
  const decision = assessEstimaticsEnvelope(envelope({
    requires_human_review: true,
    blocked_record_ids: ['blocked-1'],
  }), 'tenant-a');
  assert.equal(decision.usableForAutomation, false);
  assert.equal(decision.requiresHumanReview, true);
  assert.equal(decision.blocked, true);
});
