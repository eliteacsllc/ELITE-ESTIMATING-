import test from 'node:test';
import assert from 'node:assert/strict';
import { lifecycleEvent, MemoryLifecycleSink } from './outbox.js';

test('lifecycle sink deduplicates by idempotency key', async () => {
  const sink = new MemoryLifecycleSink();
  const first = lifecycleEvent({
    tenantId: 'tenant-a',
    topic: 'estimate.approved',
    aggregateType: 'estimate',
    aggregateId: 'estimate-1',
    payload: { revision: 2 },
    idempotencyKey: 'estimate.approved:tenant-a:estimate-1:r2',
  });
  const duplicate = { ...first, id: 'different-event-id' };
  await sink.emit(first);
  await sink.emit(duplicate);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0]?.topic, 'estimate.approved');
});
