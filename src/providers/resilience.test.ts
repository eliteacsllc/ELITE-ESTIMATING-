import test from 'node:test';
import assert from 'node:assert/strict';
import { ProviderCircuitBreaker, resilientCall } from './resilience.js';

test('provider circuit opens after repeated failures', async () => {
  const breaker = new ProviderCircuitBreaker('provider-a', { failureThreshold: 2, resetAfterMs: 60_000 });
  await assert.rejects(() => resilientCall(breaker, async () => { throw new Error('down'); }));
  await assert.rejects(() => resilientCall(breaker, async () => { throw new Error('still-down'); }));
  assert.equal(breaker.snapshot().state, 'open');
  await assert.rejects(() => resilientCall(breaker, async () => 'never'), /provider_circuit_open/);
});

test('half-open provider closes again after successful probe', async () => {
  const breaker = new ProviderCircuitBreaker('provider-b', { failureThreshold: 1, resetAfterMs: 1 });
  await assert.rejects(() => resilientCall(breaker, async () => { throw new Error('temporary'); }));
  await new Promise(resolve => setTimeout(resolve, 3));
  const result = await resilientCall(breaker, async () => 'recovered');
  assert.equal(result, 'recovered');
  assert.equal(breaker.snapshot().state, 'closed');
  assert.equal(breaker.snapshot().consecutiveFailures, 0);
});
