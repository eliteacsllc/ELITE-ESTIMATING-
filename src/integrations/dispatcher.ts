import { createHmac, timingSafeEqual } from 'node:crypto';
import { PostgresLifecycleOutbox, type PendingLifecycleEvent } from './outbox.js';

export type DispatchConfig = {
  endpoint: string;
  secret: string;
  batchSize?: number;
  maxAttempts?: number;
};

function assertEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) throw new Error('webhook_endpoint_must_use_https');
  return url;
}

export function signLifecyclePayload(secret: string, body: string): string {
  if (secret.length < 32) throw new Error('webhook_secret_too_short');
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export function verifyLifecycleSignature(secret: string, body: string, signature: string): boolean {
  const expected = signLifecyclePayload(secret, body);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

function envelope(event: PendingLifecycleEvent): string {
  return JSON.stringify({
    id: event.id,
    topic: event.topic,
    tenantId: event.tenantId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload,
    occurredAt: event.occurredAt,
    idempotencyKey: event.idempotencyKey,
  });
}

export async function dispatchOutbox(
  outbox: PostgresLifecycleOutbox,
  config: DispatchConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ delivered: number; failed: number }> {
  const endpoint = assertEndpoint(config.endpoint);
  if (config.secret.length < 32) throw new Error('webhook_secret_too_short');
  const rows = await outbox.pending(config.batchSize ?? 50, config.maxAttempts ?? 10);
  let delivered = 0;
  let failed = 0;

  for (const event of rows) {
    const body = envelope(event);
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-elite-event-id': event.id,
          'x-elite-event-topic': event.topic,
          'x-elite-idempotency-key': event.idempotencyKey,
          'x-elite-signature': signLifecyclePayload(config.secret, body),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`webhook_http_${response.status}`);
      await outbox.markPublished(event.id);
      delivered += 1;
    } catch (error) {
      failed += 1;
      await outbox.markFailed(event.id, error instanceof Error ? error.message : String(error));
    }
  }
  return { delivered, failed };
}
