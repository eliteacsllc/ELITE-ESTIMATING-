const latencyBucketsMs = [25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function normalizeMetricRoute(url = '/'): string {
  const parts = new URL(url, 'http://localhost').pathname.split('/').filter(Boolean);
  if (parts[0] !== 'v1') return '/' + parts.join('/');
  if (parts[1] === 'estimates' && parts[2]) parts[2] = ':estimateId';
  if (parts[1] === 'supplements' && parts[2]) parts[2] = ':supplementId';
  if (parts[1] === 'evidence' && parts[2]) parts[2] = ':evidenceId';
  return '/' + parts.join('/');
}

export class HttpMetrics {
  private inFlight = 0;
  private readonly requestTotals = new Map<string, number>();
  private readonly latencyCounts = new Map<string, number[]>();
  private readonly latencyTotals = new Map<string, number>();
  private readonly latencySums = new Map<string, number>();

  begin(): void { this.inFlight += 1; }

  record(method: string, route: string, statusCode: number, durationMs: number): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const normalizedMethod = method.toUpperCase();
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const totalKey = `${normalizedMethod}|${route}|${statusClass}`;
    this.requestTotals.set(totalKey, (this.requestTotals.get(totalKey) ?? 0) + 1);
    const latencyKey = `${normalizedMethod}|${route}`;
    const counts = this.latencyCounts.get(latencyKey) ?? latencyBucketsMs.map(() => 0);
    latencyBucketsMs.forEach((bucket, index) => { if (durationMs <= bucket) counts[index] = (counts[index] ?? 0) + 1; });
    this.latencyCounts.set(latencyKey, counts);
    this.latencyTotals.set(latencyKey, (this.latencyTotals.get(latencyKey) ?? 0) + 1);
    this.latencySums.set(latencyKey, (this.latencySums.get(latencyKey) ?? 0) + durationMs / 1000);
  }

  renderPrometheus(): string {
    const lines = [
      '# HELP elite_http_in_flight Current in-flight HTTP requests.',
      '# TYPE elite_http_in_flight gauge',
      `elite_http_in_flight ${this.inFlight}`,
      '# HELP elite_http_requests_total HTTP requests by method, normalized route, and status class.',
      '# TYPE elite_http_requests_total counter',
    ];
    for (const [key, value] of [...this.requestTotals.entries()].sort()) {
      const [method, route, statusClass] = key.split('|') as [string, string, string];
      lines.push(`elite_http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status_class="${escapeLabel(statusClass)}"} ${value}`);
    }
    lines.push('# HELP elite_http_request_duration_seconds HTTP request duration by normalized route.', '# TYPE elite_http_request_duration_seconds histogram');
    for (const [key, counts] of [...this.latencyCounts.entries()].sort()) {
      const [method, route] = key.split('|') as [string, string];
      latencyBucketsMs.forEach((bucket, index) => {
        lines.push(`elite_http_request_duration_seconds_bucket{method="${escapeLabel(method)}",route="${escapeLabel(route)}",le="${bucket / 1000}"} ${counts[index] ?? 0}`);
      });
      const count = this.latencyTotals.get(key) ?? 0;
      const sum = this.latencySums.get(key) ?? 0;
      lines.push(`elite_http_request_duration_seconds_bucket{method="${escapeLabel(method)}",route="${escapeLabel(route)}",le="+Inf"} ${count}`);
      lines.push(`elite_http_request_duration_seconds_sum{method="${escapeLabel(method)}",route="${escapeLabel(route)}"} ${sum}`);
      lines.push(`elite_http_request_duration_seconds_count{method="${escapeLabel(method)}",route="${escapeLabel(route)}"} ${count}`);
    }
    return lines.join('\n') + '\n';
  }
}
