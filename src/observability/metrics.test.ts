import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpMetrics, normalizeMetricRoute } from './metrics.js';

test('metric route normalization removes entity identifiers', () => {
  assert.equal(normalizeMetricRoute('/v1/estimates/123e4567-e89b-12d3-a456-426614174000/evidence'), '/v1/estimates/:estimateId/evidence');
  assert.equal(normalizeMetricRoute('/v1/supplements/abc/approve'), '/v1/supplements/:supplementId/approve');
  assert.equal(normalizeMetricRoute('/v1/evidence/ev-1/download'), '/v1/evidence/:evidenceId/download');
});

test('metrics render without request identifiers or tenant data', () => {
  const metrics = new HttpMetrics();
  metrics.begin();
  metrics.record('GET', normalizeMetricRoute('/v1/estimates/secret-id/evidence'), 200, 83);
  const output = metrics.renderPrometheus();
  assert.match(output, /elite_http_requests_total/);
  assert.match(output, /route="\/v1\/estimates\/:estimateId\/evidence"/);
  assert.doesNotMatch(output, /secret-id/);
  assert.match(output, /status_class="2xx"/);
});
