import type { LifecycleOutboxHealth } from '../integrations/outbox.js';
import type { ProviderHealthSnapshot } from '../providers/resilience.js';

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function renderOperationalMetrics(outbox: LifecycleOutboxHealth | null, providers: ProviderHealthSnapshot[] = []): string {
  const safeOutbox = outbox ?? { unpublishedTotal: 0, pendingTotal: 0, retriedTotal: 0, exhaustedTotal: 0, oldestPendingSeconds: 0 };
  const lines = [
    '# HELP elite_outbox_health_up Whether outbox health state could be read.',
    '# TYPE elite_outbox_health_up gauge',
    `elite_outbox_health_up ${outbox ? 1 : 0}`,
    '# HELP elite_outbox_unpublished Lifecycle events not yet published.',
    '# TYPE elite_outbox_unpublished gauge',
    `elite_outbox_unpublished ${safeOutbox.unpublishedTotal}`,
    '# HELP elite_outbox_pending Lifecycle events still eligible for delivery retries.',
    '# TYPE elite_outbox_pending gauge',
    `elite_outbox_pending ${safeOutbox.pendingTotal}`,
    '# HELP elite_outbox_retried Lifecycle events currently pending after at least one failed attempt.',
    '# TYPE elite_outbox_retried gauge',
    `elite_outbox_retried ${safeOutbox.retriedTotal}`,
    '# HELP elite_outbox_exhausted Lifecycle events that reached the configured delivery attempt ceiling.',
    '# TYPE elite_outbox_exhausted gauge',
    `elite_outbox_exhausted ${safeOutbox.exhaustedTotal}`,
    '# HELP elite_outbox_oldest_pending_seconds Age of the oldest retry-eligible lifecycle event.',
    '# TYPE elite_outbox_oldest_pending_seconds gauge',
    `elite_outbox_oldest_pending_seconds ${safeOutbox.oldestPendingSeconds}`,
    '# HELP elite_provider_circuit_state Provider circuit breaker state; one series is 1 per provider.',
    '# TYPE elite_provider_circuit_state gauge',
    '# HELP elite_provider_failures_total Provider query failures observed by this process.',
    '# TYPE elite_provider_failures_total gauge',
    '# HELP elite_provider_successes_total Provider query successes observed by this process.',
    '# TYPE elite_provider_successes_total gauge',
  ];
  const states = ['closed', 'open', 'half_open'] as const;
  for (const provider of [...providers].sort((a, b) => a.providerId.localeCompare(b.providerId))) {
    for (const state of states) {
      lines.push(`elite_provider_circuit_state{provider="${escapeLabel(provider.providerId)}",state="${state}"} ${provider.state === state ? 1 : 0}`);
    }
    lines.push(`elite_provider_failures_total{provider="${escapeLabel(provider.providerId)}"} ${provider.failures}`);
    lines.push(`elite_provider_successes_total{provider="${escapeLabel(provider.providerId)}"} ${provider.successes}`);
  }
  return lines.join('\n') + '\n';
}

export type OutboxHealthPolicy = {
  maxPending?: number;
  maxOldestPendingSeconds?: number;
  maxExhausted?: number;
};

export function evaluateOutboxHealth(snapshot: LifecycleOutboxHealth, policy: OutboxHealthPolicy): { healthy: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (policy.maxPending !== undefined && snapshot.pendingTotal > policy.maxPending) reasons.push('outbox_pending_threshold_exceeded');
  if (policy.maxOldestPendingSeconds !== undefined && snapshot.oldestPendingSeconds > policy.maxOldestPendingSeconds) reasons.push('outbox_age_threshold_exceeded');
  if (policy.maxExhausted !== undefined && snapshot.exhaustedTotal > policy.maxExhausted) reasons.push('outbox_exhausted_threshold_exceeded');
  return { healthy: reasons.length === 0, reasons };
}

function optionalNonNegativeInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined || !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`invalid_${name}`);
  return parsed;
}

export function outboxHealthPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): OutboxHealthPolicy {
  const maxPending = optionalNonNegativeInt(env.ELITE_OUTBOX_MAX_PENDING, 'outbox_max_pending');
  const maxOldestPendingSeconds = optionalNonNegativeInt(env.ELITE_OUTBOX_MAX_AGE_SECONDS, 'outbox_max_age_seconds');
  const maxExhausted = optionalNonNegativeInt(env.ELITE_OUTBOX_MAX_EXHAUSTED, 'outbox_max_exhausted');
  return {
    ...(maxPending !== undefined ? { maxPending } : {}),
    ...(maxOldestPendingSeconds !== undefined ? { maxOldestPendingSeconds } : {}),
    ...(maxExhausted !== undefined ? { maxExhausted } : {}),
  };
}
