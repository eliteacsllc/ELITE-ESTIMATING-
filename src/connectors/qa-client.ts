import type { DraftIQDraft } from '../intelligence/draftiq.js';

export type QaClientConfig = {
  baseUrl: string;
  token: string;
  tenantId: string;
  timeoutMs?: number;
};

export type DraftIQQaResult = {
  status: 'pass' | 'review' | 'blocked' | string;
  requiresHumanApproval: boolean;
  findings: Array<Record<string, unknown>>;
};

export async function reviewDraftIQWithQa(
  config: QaClientConfig,
  draft: DraftIQDraft,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DraftIQQaResult> {
  if (!config.token) throw new Error('qa_missing_token');
  if (!config.tenantId) throw new Error('qa_missing_tenant');
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
  if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://localhost')) throw new Error('qa_https_required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 5000);
  try {
    const response = await fetchImpl(`${baseUrl}/v1/draftiq/review`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${config.token}`,
        'x-tenant-id': config.tenantId,
        'x-request-id': requestId,
      },
      body: JSON.stringify(draft),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`qa_http_${response.status}`);
    return await response.json() as DraftIQQaResult;
  } finally {
    clearTimeout(timer);
  }
}
