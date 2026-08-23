import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EstimatingService } from '../application/estimating-service.js';
import { IdempotentEstimateCreationService } from '../application/idempotent-estimate-create.js';
import { SupplementService } from '../application/supplement-service.js';
import { IdempotentSupplementCreationService } from '../application/idempotent-supplement-create.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { PostgresEstimateRepository } from '../persistence/postgres.js';
import type { EstimateRepository } from '../persistence/repository.js';
import { InMemorySupplementRepository, PostgresSupplementRepository, type SupplementRepository } from '../persistence/supplements.js';
import { InMemoryIdempotencyRepository, PostgresIdempotencyRepository, type IdempotencyRepository } from './idempotency.js';
import { NoopAuditSink, PostgresAuditSink } from '../audit/audit.js';
import { MemoryLifecycleSink, PostgresLifecycleOutbox, type LifecycleSink } from '../integrations/outbox.js';
import { verifyHs256Token } from '../security/token.js';
import { OidcPrincipalVerifier, oidcConfigFromEnv } from '../security/oidc.js';
import { InMemoryTokenBucketRateLimiter, PostgresTokenBucketRateLimiter, principalRateLimitKey, rateLimitPolicyFromEnv, type RateLimiter } from '../security/rate-limit.js';
import type { Principal } from '../security/rbac.js';
import type { EstimateLine } from '../domain/types.js';
import type { AddSupplementChangeInput } from '../application/supplement-service.js';
import { EliteJsonInterchangeAdapter, type EliteEstimateEnvelope } from '../interchange/elite-json.js';
import { EstimateImportService } from '../interchange/import-service.js';
import { InMemoryImportReceiptRepository, PostgresImportReceiptRepository, type ImportReceiptRepository } from '../interchange/import-repository.js';
import { InMemoryEvidenceRepository, PostgresEvidenceRepository, type EvidenceRepository } from '../evidence/repository.js';
import { EvidenceService } from '../evidence/service.js';
import { EvidenceTransferService, type CreateEvidenceUploadIntentInput } from '../evidence/transfer-service.js';
import { R2EvidenceBlobStore, r2BlobStoreConfigFromEnv } from '../evidence/blob-store.js';
import type { RegisterEvidenceInput } from '../evidence/types.js';
import type { DamageGraph } from '../damage/graph.js';
import { DamageGraphService } from '../damage/service.js';
import { InMemoryDamageGraphRepository, PostgresDamageGraphRepository, type DamageGraphRepository } from '../damage/repository.js';
import { HttpMetrics, normalizeMetricRoute } from '../observability/metrics.js';
import { evaluateOutboxHealth, outboxHealthPolicyFromEnv, renderOperationalMetrics } from '../observability/operational.js';
import { appCss, appJs, indexHtml } from '../web/assets.js';
import { operationsCss, operationsJs } from '../web/operations.js';
import { supplementManagerCss, supplementManagerJs } from '../web/supplement-manager.js';

const databaseUrl = process.env.DATABASE_URL;
const allowEphemeral = process.env.ELITE_ALLOW_EPHEMERAL === '1';
const requireBlobStorage = process.env.ELITE_REQUIRE_BLOB_STORAGE === '1';
const requireIdempotency = process.env.ELITE_REQUIRE_IDEMPOTENCY === '1';
const requireRateLimit = process.env.ELITE_REQUIRE_RATE_LIMIT === '1';
const metricsToken = process.env.ELITE_METRICS_TOKEN?.trim() || null;
if (metricsToken && metricsToken.length < 32) throw new Error('metrics_token_too_short');
const outboxHealthPolicy = outboxHealthPolicyFromEnv();
const rateLimitPolicy = rateLimitPolicyFromEnv();
const rateLimiter: RateLimiter | null = rateLimitPolicy
  ? databaseUrl
    ? new PostgresTokenBucketRateLimiter(databaseUrl, rateLimitPolicy)
    : new InMemoryTokenBucketRateLimiter(rateLimitPolicy)
  : null;
const oidcConfig = oidcConfigFromEnv();
const oidcVerifier = oidcConfig ? new OidcPrincipalVerifier(oidcConfig) : null;
const r2Config = r2BlobStoreConfigFromEnv();
const blobStore = r2Config ? new R2EvidenceBlobStore(r2Config) : null;
const postgresRepository = databaseUrl ? new PostgresEstimateRepository(databaseUrl) : null;
const postgresSupplements = databaseUrl ? new PostgresSupplementRepository(databaseUrl) : null;
const postgresEvidence = databaseUrl ? new PostgresEvidenceRepository(databaseUrl) : null;
const postgresDamageGraphs = databaseUrl ? new PostgresDamageGraphRepository(databaseUrl) : null;
const postgresImportReceipts = databaseUrl ? new PostgresImportReceiptRepository(databaseUrl) : null;
const postgresIdempotency = databaseUrl ? new PostgresIdempotencyRepository(databaseUrl) : null;
const postgresOutbox = databaseUrl ? new PostgresLifecycleOutbox(databaseUrl) : null;
const memoryLifecycle = postgresOutbox ? null : new MemoryLifecycleSink();
const auditSink = databaseUrl ? new PostgresAuditSink(databaseUrl) : new NoopAuditSink();
const repository: EstimateRepository = postgresRepository ?? new InMemoryEstimateRepository();
const supplementRepository: SupplementRepository = postgresSupplements ?? new InMemorySupplementRepository();
const evidenceRepository: EvidenceRepository = postgresEvidence ?? new InMemoryEvidenceRepository();
const damageGraphRepository: DamageGraphRepository = postgresDamageGraphs ?? new InMemoryDamageGraphRepository();
const importReceiptRepository: ImportReceiptRepository = postgresImportReceipts ?? new InMemoryImportReceiptRepository();
const idempotencyRepository: IdempotencyRepository = postgresIdempotency ?? new InMemoryIdempotencyRepository();
const lifecycleSink: LifecycleSink = postgresOutbox ?? memoryLifecycle!;
const lifecycleHealthSource = postgresOutbox ?? memoryLifecycle!;
const service = new EstimatingService(repository, [], auditSink, lifecycleSink);
const idempotentCreateService = new IdempotentEstimateCreationService(service, repository, idempotencyRepository);
const supplementService = new SupplementService(repository, supplementRepository, lifecycleSink);
const idempotentSupplementCreateService = new IdempotentSupplementCreationService(supplementService, supplementRepository, idempotencyRepository);
const evidenceService = new EvidenceService(repository, evidenceRepository, blobStore ?? undefined);
const evidenceTransferService = blobStore ? new EvidenceTransferService(repository, evidenceRepository, blobStore) : null;
const damageGraphService = new DamageGraphService(repository, damageGraphRepository);
const importService = new EstimateImportService(service, repository, importReceiptRepository);
const interchange = new EliteJsonInterchangeAdapter();
const httpMetrics = new HttpMetrics();

function baseHeaders(): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
  };
}

function send(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...baseHeaders(),
    ...extra,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, contentType: string, payload: string, csp?: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, {
    ...baseHeaders(),
    ...extra,
    'content-type': contentType,
    'content-length': Buffer.byteLength(payload),
    ...(csp ? { 'content-security-policy': csp } : {}),
  });
  res.end(payload);
}

async function json(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error('request_too_large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function metricsAuthorized(req: IncomingMessage): boolean {
  if (!metricsToken) return false;
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(metricsToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function principal(req: IncomingMessage): Promise<Principal> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) throw new Error('unauthorized');
  const token = authorization.slice(7);
  if (oidcVerifier) {
    try { return await oidcVerifier.verify(token); } catch { throw new Error('unauthorized'); }
  }
  const secret = process.env.ELITE_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('unauthorized');
  const claims = verifyHs256Token(token, secret);
  return { userId: claims.userId, tenantId: claims.tenantId, roles: claims.roles };
}

function requestUrl(url = '/'): URL { return new URL(url, 'http://localhost'); }
function pathParts(url = '/'): string[] { return requestUrl(url).pathname.split('/').filter(Boolean); }

async function readiness(): Promise<{
  ready: boolean;
  authConfigured: boolean;
  authMode: 'oidc' | 'service_token' | 'unconfigured';
  durableStorage: boolean;
  databaseHealthy: boolean;
  lifecycleOutbox: boolean;
  evidenceStorage: boolean;
  damageGraphStorage: boolean;
  importReceiptStorage: boolean;
  idempotencyStorage: boolean;
  idempotencyRequired: boolean;
  rateLimitConfigured: boolean;
  rateLimitDurable: boolean;
  rateLimitHealthy: boolean;
  rateLimitRequired: boolean;
  blobStorageConfigured: boolean;
  blobStorageRequired: boolean;
  metricsConfigured: boolean;
  outboxHealthAvailable: boolean;
  outboxHealthy: boolean;
  outboxHealthReasons: string[];
  outboxPending: number;
  outboxExhausted: number;
  outboxOldestPendingSeconds: number;
}> {
  const serviceTokenConfigured = Boolean(process.env.ELITE_AUTH_SECRET && process.env.ELITE_AUTH_SECRET.length >= 32);
  const authMode = oidcVerifier ? 'oidc' : serviceTokenConfigured ? 'service_token' : 'unconfigured';
  const authConfigured = authMode !== 'unconfigured';
  const durableStorage = Boolean(postgresRepository && postgresSupplements && postgresEvidence && postgresDamageGraphs && postgresImportReceipts && postgresIdempotency && postgresOutbox);
  const databaseHealthy = postgresRepository ? await postgresRepository.health().catch(() => false) : allowEphemeral;
  const lifecycleOutbox = Boolean(postgresOutbox) || allowEphemeral;
  const evidenceStorage = Boolean(postgresEvidence) || allowEphemeral;
  const damageGraphStorage = postgresDamageGraphs ? await postgresDamageGraphs.health().catch(() => false) : allowEphemeral;
  const importReceiptStorage = postgresImportReceipts ? await postgresImportReceipts.health().catch(() => false) : allowEphemeral;
  const idempotencyStorage = postgresIdempotency ? await postgresIdempotency.health().catch(() => false) : allowEphemeral;
  const blobStorageConfigured = Boolean(blobStore);
  const blobReady = !requireBlobStorage || blobStorageConfigured;
  const rateLimitConfigured = Boolean(rateLimiter);
  const rateLimitDurable = rateLimiter instanceof PostgresTokenBucketRateLimiter;
  const rateLimitHealthy = rateLimiter?.health ? await rateLimiter.health().catch(() => false) : rateLimitConfigured;
  const rateLimitReady = !requireRateLimit || (rateLimitConfigured && rateLimitHealthy && (rateLimitDurable || allowEphemeral));
  const outboxHealth = await lifecycleHealthSource.healthSnapshot().catch(() => null);
  const outboxEvaluation = outboxHealth
    ? evaluateOutboxHealth(outboxHealth, outboxHealthPolicy)
    : { healthy: false, reasons: ['outbox_health_unavailable'] };
  return {
    ready: authConfigured && databaseHealthy && lifecycleOutbox && evidenceStorage && damageGraphStorage && importReceiptStorage && idempotencyStorage && blobReady && rateLimitReady && outboxEvaluation.healthy && (durableStorage || allowEphemeral),
    authConfigured,
    authMode,
    durableStorage,
    databaseHealthy,
    lifecycleOutbox,
    evidenceStorage,
    damageGraphStorage,
    importReceiptStorage,
    idempotencyStorage,
    idempotencyRequired: requireIdempotency,
    rateLimitConfigured,
    rateLimitDurable,
    rateLimitHealthy,
    rateLimitRequired: requireRateLimit,
    blobStorageConfigured,
    blobStorageRequired: requireBlobStorage,
    metricsConfigured: Boolean(metricsToken),
    outboxHealthAvailable: Boolean(outboxHealth),
    outboxHealthy: outboxEvaluation.healthy,
    outboxHealthReasons: outboxEvaluation.reasons,
    outboxPending: outboxHealth?.pendingTotal ?? 0,
    outboxExhausted: outboxHealth?.exhaustedTotal ?? 0,
    outboxOldestPendingSeconds: outboxHealth?.oldestPendingSeconds ?? 0,
  };
}

const server = createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  const metricRoute = normalizeMetricRoute(req.url);
  httpMetrics.begin();
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    httpMetrics.record(req.method ?? 'UNKNOWN', metricRoute, res.statusCode, durationMs);
  });

  try {
    if (req.method === 'GET' && req.url === '/metrics') {
      if (!metricsAuthorized(req)) return send(res, 404, { error: 'not_found' });
      const outboxHealth = await lifecycleHealthSource.healthSnapshot().catch(() => null);
      const payload = httpMetrics.renderPrometheus() + renderOperationalMetrics(outboxHealth);
      return sendText(res, 200, 'text/plain; version=0.0.4; charset=utf-8', payload, "default-src 'none'; frame-ancestors 'none'");
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const html = indexHtml
        .replace('</head>', '<link rel="stylesheet" href="/ops.css"><link rel="stylesheet" href="/supp.css"></head>')
        .replace('</body>', '<script src="/ops.js" defer></script><script src="/supp.js" defer></script></body>');
      return sendText(res, 200, 'text/html; charset=utf-8', html, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    }
    if (req.method === 'GET' && req.url === '/app.js') return sendText(res, 200, 'text/javascript; charset=utf-8', appJs);
    if (req.method === 'GET' && req.url === '/app.css') return sendText(res, 200, 'text/css; charset=utf-8', appCss);
    if (req.method === 'GET' && req.url === '/ops.js') return sendText(res, 200, 'text/javascript; charset=utf-8', operationsJs);
    if (req.method === 'GET' && req.url === '/ops.css') return sendText(res, 200, 'text/css; charset=utf-8', operationsCss);
    if (req.method === 'GET' && req.url === '/supp.js') return sendText(res, 200, 'text/javascript; charset=utf-8', supplementManagerJs);
    if (req.method === 'GET' && req.url === '/supp.css') return sendText(res, 200, 'text/css; charset=utf-8', supplementManagerCss);
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok', service: 'elite-estimating' });
    if (req.method === 'GET' && req.url === '/ready') {
      const state = await readiness();
      return send(res, state.ready ? 200 : 503, { status: state.ready ? 'ready' : 'not_ready', ...state });
    }

    const actor = await principal(req);
    if (rateLimiter) {
      const result = await rateLimiter.consume(principalRateLimitKey(actor));
      if (!result.allowed) {
        return send(res, 429, { error: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds }, {
          'retry-after': String(result.retryAfterSeconds),
          'x-ratelimit-remaining': String(result.remaining),
        });
      }
    }
    const url = requestUrl(req.url);
    const parts = pathParts(req.url);

    if (req.method === 'POST' && parts.join('/') === 'v1/imports/elite-json') {
      const result = await importService.importElite(actor, await json(req) as unknown as EliteEstimateEnvelope);
      return send(res, result.idempotent ? 200 : 201, result);
    }

    if (parts[0] === 'v1' && parts[1] === 'evidence' && parts[2] && req.method === 'GET' && parts[3] === 'download') {
      if (!evidenceTransferService) throw new Error('blob_storage_not_configured');
      return send(res, 200, await evidenceTransferService.createDownloadUrl(actor, parts[2]));
    }

    if (parts.join('/') === 'v1/estimates') {
      if (req.method === 'POST') {
        const body = await json(req);
        if (!body.asset || typeof body.asset !== 'object') throw new Error('asset_required');
        const claimId = typeof body.claimId === 'string' && body.claimId.trim() ? body.claimId.trim() : null;
        const createInput = {
          ...(claimId ? { claimId } : {}),
          asset: body.asset as never,
          locale: String(body.locale ?? 'en-US'),
          currency: String(body.currency ?? 'USD'),
          jurisdiction: String(body.jurisdiction ?? 'US'),
        };
        const idempotencyKey = singleHeader(req.headers['idempotency-key']);
        if (requireIdempotency && !idempotencyKey) throw new Error('idempotency_key_required');
        if (idempotencyKey) {
          const result = await idempotentCreateService.create(actor, idempotencyKey, createInput);
          return send(res, result.replayed ? 200 : 201, result.estimate, { 'idempotency-replayed': String(result.replayed) });
        }
        return send(res, 201, await service.create(actor, { tenantId: actor.tenantId, ...createInput }));
      }
      if (req.method === 'GET') {
        const claimId = url.searchParams.get('claimId');
        if (claimId) return send(res, 200, await service.listByClaim(actor, claimId));
        const requested = Number(url.searchParams.get('limit') ?? 25);
        const limit = Number.isFinite(requested) ? requested : 25;
        return send(res, 200, await service.listRecent(actor, limit));
      }
    }

    if (parts[0] === 'v1' && parts[1] === 'supplements' && parts[2]) {
      const supplementId = parts[2];
      if (req.method === 'POST' && parts[3] === 'changes') {
        const body = await json(req);
        return send(res, 200, await supplementService.addChange(actor, supplementId, body as AddSupplementChangeInput));
      }
      if (req.method === 'POST' && parts[3] === 'submit') return send(res, 200, await supplementService.submit(actor, supplementId));
      if (req.method === 'POST' && parts[3] === 'approve') return send(res, 200, await supplementService.approve(actor, supplementId));
    }

    if (parts[0] === 'v1' && parts[1] === 'estimates' && parts[2]) {
      const id = parts[2];
      if (req.method === 'GET' && parts.length === 3) return send(res, 200, await service.get(actor, id));
      if (parts[3] === 'damage-graph' && parts.length === 4) {
        if (req.method === 'GET') {
          const revisionValue = url.searchParams.get('revision');
          const revision = revisionValue === null ? undefined : Number(revisionValue);
          if (revision !== undefined && (!Number.isInteger(revision) || revision < 1)) throw new Error('invalid_damage_graph_revision');
          return send(res, 200, await damageGraphService.get(actor, id, revision));
        }
        if (req.method === 'PUT') return send(res, 200, await damageGraphService.save(actor, id, await json(req) as unknown as DamageGraph));
      }
      if (req.method === 'GET' && parts[3] === 'export') {
        const estimate = await service.get(actor, id);
        const payload = new TextDecoder().decode(interchange.exportEstimate(estimate));
        return sendText(res, 200, 'application/json; charset=utf-8', payload, undefined, { 'content-disposition': `attachment; filename="elite-estimate-${estimate.id}.json"` });
      }
      if (parts[3] === 'evidence' && parts[4] === 'upload-intent' && parts.length === 5 && req.method === 'POST') {
        if (!evidenceTransferService) throw new Error('blob_storage_not_configured');
        return send(res, 201, await evidenceTransferService.createUploadIntent(actor, id, await json(req) as unknown as CreateEvidenceUploadIntentInput));
      }
      if (parts[3] === 'evidence' && parts.length === 4) {
        if (req.method === 'GET') return send(res, 200, await evidenceService.list(actor, id));
        if (req.method === 'POST') return send(res, 201, await evidenceService.register(actor, id, await json(req) as unknown as RegisterEvidenceInput));
      }
      if (parts[3] === 'supplements' && parts.length === 4) {
        if (req.method === 'POST') {
          const idempotencyKey = singleHeader(req.headers['idempotency-key']);
          if (requireIdempotency && !idempotencyKey) throw new Error('idempotency_key_required');
          if (idempotencyKey) {
            const result = await idempotentSupplementCreateService.create(actor, idempotencyKey, id);
            return send(res, result.replayed ? 200 : 201, result.supplement, { 'idempotency-replayed': String(result.replayed) });
          }
          return send(res, 201, await supplementService.create(actor, id));
        }
        if (req.method === 'GET') return send(res, 200, await supplementService.list(actor, id));
      }
      if (req.method === 'PUT' && parts[3] === 'lines') {
        const body = await json(req);
        if (!Array.isArray(body.lines)) throw new Error('lines_array_required');
        return send(res, 200, await service.replaceLines(actor, id, body.lines as EstimateLine[]));
      }
      if (req.method === 'POST' && parts[3] === 'approve') return send(res, 200, await service.approve(actor, id));
      if (req.method === 'POST' && parts[3] === 'void') return send(res, 200, await service.void(actor, id));
    }

    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    const status = message === 'unauthorized' || message.startsWith('invalid_token') || message === 'token_expired' ? 401
      : message.includes('not_permitted') || message.includes('access_denied') ? 403
      : message === 'estimate_not_found' || message === 'supplement_not_found' || message === 'damage_graph_not_found' || message === 'evidence_not_found' ? 404
      : message === 'idempotency_key_reused_with_different_request'
        || message === 'idempotency_request_in_progress'
        || message === 'idempotency_resource_conflict'
        || message === 'estimate_concurrent_modification'
        || message === 'evidence_source_conflict' ? 409
      : message === 'blob_storage_not_configured' ? 503
      : message === 'request_too_large' ? 413
      : 400;
    return send(res, status, { error: message });
  }
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, '0.0.0.0', () => { console.log(`elite-estimating listening on ${port}`); });

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.close();
  if (postgresRepository) await postgresRepository.close();
  if (postgresSupplements) await postgresSupplements.close();
  if (postgresEvidence) await postgresEvidence.close();
  if (postgresDamageGraphs) await postgresDamageGraphs.close();
  if (postgresImportReceipts) await postgresImportReceipts.close();
  if (postgresIdempotency) await postgresIdempotency.close();
  if (postgresOutbox) await postgresOutbox.close();
  if (auditSink instanceof PostgresAuditSink) await auditSink.close();
  if (rateLimiter?.close) await rateLimiter.close();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);