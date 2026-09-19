import { validateEstimaticsEnvelope, type EstimaticsEnvelope } from './estimatics.js';

export type EstimaticsQuery = {
  year: number;
  make: string;
  model?: string;
  trim?: string;
  engine?: string;
  vin?: string;
  region?: string;
  kinds?: string[];
};

export type EstimaticsClientConfig = {
  baseUrl: string;
  token: string;
  tenantId: string;
  timeoutMs?: number;
  retries?: number;
};

const retryable = new Set([502, 503, 504]);

export async function queryEstimatics(
  config: EstimaticsClientConfig,
  query: EstimaticsQuery,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EstimaticsEnvelope> {
  if (!config.token) throw new Error('estimatics_missing_token');
  if (!config.tenantId) throw new Error('estimatics_missing_tenant');
  if (!requestId) throw new Error('estimatics_missing_request_id');
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
  if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://localhost')) {
    throw new Error('estimatics_https_required');
  }
  const attempts = Math.max(1, Math.min(3, (config.retries ?? 1) + 1));
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);
    try {
      const response = await fetchImpl(`${baseUrl}/v1/knowledge/search`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${config.token}`,
          'x-tenant-id': config.tenantId,
          'x-request-id': requestId,
        },
        body: JSON.stringify(query),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (retryable.has(response.status) && attempt + 1 < attempts) continue;
        throw new Error(`estimatics_http_${response.status}`);
      }
      return validateEstimaticsEnvelope(await response.json(), config.tenantId);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('estimatics_request_failed');
      if (attempt + 1 >= attempts) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error('estimatics_request_failed');
}
