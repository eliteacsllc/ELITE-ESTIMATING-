export type CircuitState = 'closed' | 'open' | 'half_open';

export type ProviderHealthSnapshot = {
  providerId: string;
  state: CircuitState;
  consecutiveFailures: number;
  successes: number;
  failures: number;
  lastLatencyMs?: number;
  lastError?: string;
  openedAt?: string;
};

export type CircuitBreakerOptions = {
  failureThreshold: number;
  resetAfterMs: number;
};

export class ProviderCircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private successes = 0;
  private failures = 0;
  private lastLatencyMs: number | undefined;
  private lastError: string | undefined;
  private openedAtMs: number | undefined;

  constructor(
    readonly providerId: string,
    private readonly options: CircuitBreakerOptions = { failureThreshold: 3, resetAfterMs: 30_000 },
  ) {
    if (options.failureThreshold < 1 || options.resetAfterMs < 1) throw new Error('invalid_circuit_breaker_options');
  }

  canRequest(now = Date.now()): boolean {
    if (this.state !== 'open') return true;
    if (this.openedAtMs !== undefined && now - this.openedAtMs >= this.options.resetAfterMs) {
      this.state = 'half_open';
      return true;
    }
    return false;
  }

  recordSuccess(latencyMs: number): void {
    this.successes += 1;
    this.consecutiveFailures = 0;
    this.lastLatencyMs = latencyMs;
    this.lastError = undefined;
    this.openedAtMs = undefined;
    this.state = 'closed';
  }

  recordFailure(error: unknown, latencyMs?: number): void {
    this.failures += 1;
    this.consecutiveFailures += 1;
    if (latencyMs !== undefined) this.lastLatencyMs = latencyMs;
    this.lastError = error instanceof Error ? error.message : String(error);
    if (this.state === 'half_open' || this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'open';
      this.openedAtMs = Date.now();
    }
  }

  snapshot(): ProviderHealthSnapshot {
    return {
      providerId: this.providerId,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      successes: this.successes,
      failures: this.failures,
      ...(this.lastLatencyMs !== undefined ? { lastLatencyMs: this.lastLatencyMs } : {}),
      ...(this.lastError !== undefined ? { lastError: this.lastError } : {}),
      ...(this.openedAtMs !== undefined ? { openedAt: new Date(this.openedAtMs).toISOString() } : {}),
    };
  }
}

export async function resilientCall<T>(breaker: ProviderCircuitBreaker, operation: () => Promise<T>): Promise<T> {
  if (!breaker.canRequest()) throw new Error(`provider_circuit_open:${breaker.providerId}`);
  const started = Date.now();
  try {
    const value = await operation();
    breaker.recordSuccess(Date.now() - started);
    return value;
  } catch (error) {
    breaker.recordFailure(error, Date.now() - started);
    throw error;
  }
}
