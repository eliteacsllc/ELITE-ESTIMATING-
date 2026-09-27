export interface IntelligenceFabricClientOptions {
  baseUrl?: string;
  apiKey?: string;
  tenantId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface IntelligencePreflightInput<T = unknown> {
  requestId?: string;
  subjectId: string;
  domain: string;
  capability: string;
  actorId: string;
  input: T;
  evidence?: unknown[];
  requiresHumanApproval?: boolean;
}

export interface IntelligencePreflightResult {
  allowed: boolean;
  supported: boolean;
  requiresHumanApproval: boolean;
  reasons: string[];
}

function cleanBaseUrl(value?: string): string {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("invalid_intelligence_fabric_url");
  }
  return raw;
}

export class IntelligenceFabricError extends Error {
  readonly status?: number;
  readonly payload?: unknown;
  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    if (status !== undefined) this.status = status;
    if (payload !== undefined) this.payload = payload;
  }
}

export class IntelligenceFabricClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly tenantId: string;
  readonly timeoutMs: number;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: IntelligenceFabricClientOptions = {}) {
    this.baseUrl = cleanBaseUrl(options.baseUrl);
    this.apiKey = String(options.apiKey ?? "").trim();
    this.tenantId = String(options.tenantId ?? "").trim();
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  get configured(): boolean {
    return Boolean(this.baseUrl && this.apiKey && this.tenantId && this.fetchImpl);
  }

  private async post<T>(pathname: string, body: unknown): Promise<T> {
    if (!this.configured || !this.fetchImpl) throw new IntelligenceFabricError("intelligence_fabric_not_configured");
    const response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${this.apiKey}`,
        "x-tenant-id": this.tenantId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new IntelligenceFabricError("intelligence_fabric_request_failed", response.status, payload);
    return payload as T;
  }

  preflight<T = unknown>(input: IntelligencePreflightInput<T>): Promise<IntelligencePreflightResult> {
    return this.post("/v1/intelligence/preflight", {
      requestId: input.requestId ?? crypto.randomUUID(),
      subjectId: input.subjectId,
      domain: input.domain,
      capability: input.capability,
      actorId: input.actorId,
      input: input.input,
      evidence: input.evidence ?? [],
      requiresHumanApproval: input.requiresHumanApproval ?? false,
    });
  }

  validateFinding<T = unknown>(finding: T): Promise<{ valid: boolean; findingId: string; tenantId: string; status: string; evidenceCount: number }> {
    return this.post("/v1/intelligence/findings/validate", finding);
  }
}
