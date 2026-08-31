import assert from 'node:assert/strict';
import test from 'node:test';
import { createDispatchDelivery, dispatchIdempotencyKey, recordDispatchAttempt, shouldRetryDispatch } from './dispatch-delivery.js';

test('same estimate revision and recipient produce deterministic dispatch key', () => {
  const input = { recipientId: 'shop-1', estimateId: 'estimate-1', revision: 2, channel: 'api', format: 'elite-json-v1' };
  assert.equal(dispatchIdempotencyKey(input), dispatchIdempotencyKey(input));
});

test('blocked dispatch plan cannot create a delivery', () => {
  assert.throws(() => createDispatchDelivery({
    recipientId: 'shop-1', estimateId: 'estimate-1', revision: 1,
    plan: { channel: 'manual_portal', format: null, automated: false, blockers: ['recipient_market_unsupported'] },
  }), /dispatch_plan_blocked/);
});

test('retryable failures are bounded and acknowledgement is terminal', () => {
  const planned = createDispatchDelivery({
    recipientId: 'shop-1', estimateId: 'estimate-1', revision: 1,
    plan: { channel: 'api', format: 'elite-json-v1', automated: true, blockers: [] },
  });
  const failed = recordDispatchAttempt(planned, { at: '2026-08-30T00:00:00Z', outcome: 'retryable_failure', errorCode: 'timeout' });
  assert.equal(shouldRetryDispatch(failed, 2), true);
  const acknowledged = recordDispatchAttempt(failed, { at: '2026-08-30T00:01:00Z', outcome: 'acknowledged', providerReference: 'receipt-1' });
  assert.equal(acknowledged.status, 'acknowledged');
  assert.equal(shouldRetryDispatch(acknowledged, 2), false);
  assert.throws(() => recordDispatchAttempt(acknowledged, { at: '2026-08-30T00:02:00Z', outcome: 'sent' }), /dispatch_terminal_state/);
});
