import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOutboxHealth, outboxHealthPolicyFromEnv, renderOperationalMetrics } from './operational.js';

test('outbox thresholds report precise degradation reasons', () => {
  const snapshot = { unpublishedTotal: 15, pendingTotal: 12, retriedTotal: 3, exhaustedTotal: 2, oldestPendingSeconds: 900 };
  const result = evaluateOutboxHealth(snapshot, { maxPending: 10, maxOldestPendingSeconds: 600, maxExhausted: 0 });
  assert.equal(result.healthy, false);
  assert.deepEqual(result.reasons, [
    'outbox_pending_threshold_exceeded',
    'outbox_age_threshold_exceeded',
    'outbox_exhausted_threshold_exceeded',
  ]);
});

test('unset outbox thresholds do not invent launch limits', () => {
  const policy = outboxHealthPolicyFromEnv({});
  assert.deepEqual(policy, {});
  const result = evaluateOutboxHealth({ unpublishedTotal: 999, pendingTotal: 999, retriedTotal: 20, exhaustedTotal: 5, oldestPendingSeconds: 99999 }, policy);
  assert.equal(result.healthy, true);
});

test('invalid outbox thresholds fail configuration', () => {
  assert.throws(() => outboxHealthPolicyFromEnv({ ELITE_OUTBOX_MAX_PENDING: '-1' }), /invalid_outbox_max_pending/);
  assert.throws(() => outboxHealthPolicyFromEnv({ ELITE_OUTBOX_MAX_AGE_SECONDS: '1.5' }), /invalid_outbox_max_age_seconds/);
});

test('operational metrics contain aggregate outbox and low-cardinality provider state only', () => {
  const output = renderOperationalMetrics(
    { unpublishedTotal: 4, pendingTotal: 3, retriedTotal: 1, exhaustedTotal: 1, oldestPendingSeconds: 12.5 },
    [{ providerId: 'motor-oem', state: 'open', consecutiveFailures: 3, successes: 10, failures: 3, lastError: 'secret claim CLM-123' }],
  );
  assert.match(output, /elite_outbox_pending 3/);
  assert.match(output, /elite_outbox_exhausted 1/);
  assert.match(output, /provider="motor-oem",state="open"\} 1/);
  assert.doesNotMatch(output, /CLM-123/);
  assert.doesNotMatch(output, /lastError/);
});
