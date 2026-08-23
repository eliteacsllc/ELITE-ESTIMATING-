import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EstimatingService } from '../application/estimating-service.js';
import { SupplementService } from '../application/supplement-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { PostgresEstimateRepository } from '../persistence/postgres.js';
import type { EstimateRepository } from '../persistence/repository.js';
import { InMemorySupplementRepository, PostgresSupplementRepository, type SupplementRepository } from '../persistence/supplements.js';
import { NoopAuditSink, PostgresAuditSink } from '../audit/audit.js';
import { verifyHs256Token } from '../security/token.js';
import type { Principal } from '../security/rbac.js';
import type { EstimateLine } from '../domain/types.js';
import type { AddSupplementChangeInput } from '../application/supplement-service.js';
import { appCss, appJs, indexHtml } from '../web/assets.js';

const databaseUrl = process.env.DATABASE_URL;
const allowEphemeral = process.env.ELITE_ALLOW_EPHEMERAL === '1';
const postgresRepository = databaseUrl ? new PostgresEstimateRepository(databaseUrl) : null;
const postgresSupplements = databaseUrl ? new PostgresSupplementRepository(databaseUrl) : null;
const auditSink = databaseUrl ? new PostgresAuditSink(databaseUrl) : new NoopAuditSink();
const repository: EstimateRepository = postgresRepository ?? new InMemoryEstimateRepository();
const supplementRepository: SupplementRepository = postgresSupplements ?? new InMemorySupplementRepository();
const service = new EstimatingService(repository, [], auditSink);
const supplementService = new SupplementService(repository, supplementRepository);

function baseHeaders(): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...baseHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, contentType: string, payload: string, csp?: string): void {
  res.writeHead(status, {
    ...baseHeaders(),
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

function principal(req: IncomingMessage): Principal {
  const authorization = req.headers.authorization;
  const secret = process.env.ELITE_AUTH_SECRET;
  if (!authorization?.startsWith('Bearer ') || !secret || secret.length < 32) throw new Error('unauthorized');
  const claims = verifyHs256Token(authorization.slice(7), secret);
  return { userId: claims.userId, tenantId: claims.tenantId, roles: claims.roles };
}

function pathParts(url = '/'): string[] {
  return new URL(url, 'http://localhost').pathname.split('/').filter(Boolean);
}

async function readiness(): Promise<{ ready: boolean; authConfigured: boolean; durableStorage: boolean; databaseHealthy: boolean }> {
  const authConfigured = Boolean(process.env.ELITE_AUTH_SECRET && process.env.ELITE_AUTH_SECRET.length >= 32);
  const durableStorage = Boolean(postgresRepository && postgresSupplements);
  const databaseHealthy = postgresRepository ? await postgresRepository.health().catch(() => false) : allowEphemeral;
  return { ready: authConfigured && databaseHealthy && (durableStorage || allowEphemeral), authConfigured, durableStorage, databaseHealthy };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      return sendText(res, 200, 'text/html; charset=utf-8', indexHtml, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    }
    if (req.method === 'GET' && req.url === '/app.js') return sendText(res, 200, 'text/javascript; charset=utf-8', appJs);
    if (req.method === 'GET' && req.url === '/app.css') return sendText(res, 200, 'text/css; charset=utf-8', appCss);
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok', service: 'elite-estimating' });
    if (req.method === 'GET' && req.url === '/ready') {
      const state = await readiness();
      return send(res, state.ready ? 200 : 503, { status: state.ready ? 'ready' : 'not_ready', ...state });
    }

    const actor = principal(req);
    const parts = pathParts(req.url);

    if (req.method === 'POST' && parts.join('/') === 'v1/estimates') {
      const body = await json(req);
      if (!body.asset || typeof body.asset !== 'object') throw new Error('asset_required');
      const claimId = typeof body.claimId === 'string' && body.claimId.trim() ? body.claimId.trim() : null;
      const estimate = await service.create(actor, {
        tenantId: actor.tenantId,
        ...(claimId ? { claimId } : {}),
        asset: body.asset as never,
        locale: String(body.locale ?? 'en-US'),
        currency: String(body.currency ?? 'USD'),
        jurisdiction: String(body.jurisdiction ?? 'US'),
      });
      return send(res, 201, estimate);
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
      if (parts[3] === 'supplements' && parts.length === 4) {
        if (req.method === 'POST') return send(res, 201, await supplementService.create(actor, id));
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
      : message === 'estimate_not_found' || message === 'supplement_not_found' ? 404
      : message === 'request_too_large' ? 413
      : 400;
    return send(res, status, { error: message });
  }
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, '0.0.0.0', () => {
  console.log(`elite-estimating listening on ${port}`);
});

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.close();
  if (postgresRepository) await postgresRepository.close();
  if (postgresSupplements) await postgresSupplements.close();
  if (auditSink instanceof PostgresAuditSink) await auditSink.close();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
