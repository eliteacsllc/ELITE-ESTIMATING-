import assert from 'node:assert/strict';
import test from 'node:test';
import { planUniversalDispatch } from './universal-dispatch.js';

const recipient = {
  id: 'shop-a',
  channels: ['api','secure_link','manual_portal'] as const,
  supportedFormats: ['elite-json-v1'],
  regions: ['US'],
};

test('prefers automated API dispatch when format matches', () => {
  assert.deepEqual(planUniversalDispatch({ recipient: { ...recipient, channels: [...recipient.channels] }, market: 'US', preferredFormats: ['elite-json-v1'], allowManualFallback: true }), {
    channel: 'api', format: 'elite-json-v1', automated: true, blockers: [],
  });
});

test('falls back to secure link when no interchange format matches', () => {
  const result = planUniversalDispatch({ recipient: { ...recipient, channels: [...recipient.channels] }, market: 'US', preferredFormats: ['unknown'], allowManualFallback: true });
  assert.equal(result.channel, 'secure_link');
  assert.equal(result.automated, true);
});

test('unsupported market blocks dispatch', () => {
  assert.ok(planUniversalDispatch({ recipient: { ...recipient, channels: [...recipient.channels] }, market: 'EU', preferredFormats: ['elite-json-v1'], allowManualFallback: true }).blockers.includes('recipient_market_unsupported'));
});
