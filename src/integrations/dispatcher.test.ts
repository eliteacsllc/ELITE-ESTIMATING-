import test from 'node:test';
import assert from 'node:assert/strict';
import { signLifecyclePayload, verifyLifecycleSignature } from './dispatcher.js';

test('lifecycle signatures verify and reject tampering', () => {
  const secret = 'a-secret-longer-than-thirty-two-characters';
  const body = JSON.stringify({ topic: 'estimate.approved', id: 'evt-1' });
  const signature = signLifecyclePayload(secret, body);
  assert.equal(verifyLifecycleSignature(secret, body, signature), true);
  assert.equal(verifyLifecycleSignature(secret, body + 'tampered', signature), false);
});

test('short webhook secrets are rejected', () => {
  assert.throws(() => signLifecyclePayload('short', '{}'), /webhook_secret_too_short/);
});
