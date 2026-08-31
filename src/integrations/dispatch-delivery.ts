import { createHash } from 'node:crypto';
import type { DispatchPlan } from './universal-dispatch.js';

export type DispatchDeliveryStatus = 'planned' | 'sent' | 'acknowledged' | 'retryable_failure' | 'permanent_failure';

export type DispatchDelivery = {
  idempotencyKey: string;
  recipientId: string;
  estimateId: string;
  revision: number;
  channel: DispatchPlan['channel'];
  format: string | null;
  status: DispatchDeliveryStatus;
  attempt: number;
  lastAttemptAt?: string;
  acknowledgedAt?: string;
  providerReference?: string;
  errorCode?: string;
};

export function dispatchIdempotencyKey(input: { recipientId: string; estimateId: string; revision: number; channel: string; format: string | null }): string {
  if (!input.recipientId.trim() || !input.estimateId.trim()) throw new Error('dispatch_identity_required');
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error('dispatch_revision_invalid');
  return createHash('sha256').update(JSON.stringify({
    recipientId: input.recipientId.trim(), estimateId: input.estimateId.trim(), revision: input.revision,
    channel: input.channel, format: input.format ?? null,
  })).digest('hex');
}

export function createDispatchDelivery(input: { recipientId: string; estimateId: string; revision: number; plan: DispatchPlan }): DispatchDelivery {
  if (input.plan.blockers.length) throw new Error(`dispatch_plan_blocked:${input.plan.blockers.join('|')}`);
  return {
    idempotencyKey: dispatchIdempotencyKey({ recipientId: input.recipientId, estimateId: input.estimateId, revision: input.revision, channel: input.plan.channel, format: input.plan.format }),
    recipientId: input.recipientId.trim(), estimateId: input.estimateId.trim(), revision: input.revision,
    channel: input.plan.channel, format: input.plan.format, status: 'planned', attempt: 0,
  };
}

export function recordDispatchAttempt(delivery: DispatchDelivery, input: {
  at: string; outcome: 'sent' | 'acknowledged' | 'retryable_failure' | 'permanent_failure'; providerReference?: string; errorCode?: string;
}): DispatchDelivery {
  if (delivery.status === 'acknowledged' || delivery.status === 'permanent_failure') throw new Error(`dispatch_terminal_state:${delivery.status}`);
  if (!Number.isFinite(Date.parse(input.at))) throw new Error('dispatch_attempt_time_invalid');
  if (input.outcome === 'retryable_failure' && !input.errorCode?.trim()) throw new Error('dispatch_retry_error_required');
  if (input.outcome === 'permanent_failure' && !input.errorCode?.trim()) throw new Error('dispatch_failure_error_required');
  return {
    ...delivery,
    status: input.outcome,
    attempt: delivery.attempt + 1,
    lastAttemptAt: input.at,
    ...(input.outcome === 'acknowledged' ? { acknowledgedAt: input.at } : {}),
    ...(input.providerReference?.trim() ? { providerReference: input.providerReference.trim() } : {}),
    ...(input.errorCode?.trim() ? { errorCode: input.errorCode.trim() } : { errorCode: undefined }),
  };
}

export function shouldRetryDispatch(delivery: DispatchDelivery, maximumAttempts = 5): boolean {
  if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1) throw new Error('dispatch_max_attempts_invalid');
  return delivery.status === 'retryable_failure' && delivery.attempt < maximumAttempts;
}
