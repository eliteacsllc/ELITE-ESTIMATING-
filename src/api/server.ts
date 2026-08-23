import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { verifyHs256Token } from '../security/token.js';
import type { Principal } from '../security/rbac.js';
import type { EstimateLine } from '../domain/types.js';

const repository = new InMemoryEstimateRepository();
const service = new EstimatingService(repository);

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
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

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'ok', service: 'elite-estimating' });
    if (req.method === 'GET' && req.url === '/ready') {
      const configured = Boolean(process.env.ELITE_AUTH_SECRET && process.env.ELITE_AUTH_SECRET.length >= 32);
      return send(res, configured ? 200 : 503, { status: configured ? 'ready' : 'not_ready', authConfigured: configured });
    }

    const actor = principal(req);
    const parts = pathParts(req.url);

    if (req.method === 'POST' && parts.join('/') === 'v1/estimates') {
      const body = await json(req);
      const estimate = await service.create(actor, {
        tenantId: actor.tenantId,
        claimId: typeof body.claimId === 'string' ? body.claimId : undefined,
        asset: body.asset as never,
        locale: String(body.locale ?? 'en-US'),
        currency: String(body.currency ?? 'USD'),
        jurisdiction: String(body.jurisdiction ?? 'US'),
      });
      return send(res, 201, estimate);
    }

    if (parts[0] === 'v1' && parts[1] === 'estimates' && parts[2]) {
      const id = parts[2];
      if (req.method === 'GET' && parts.length === 3) return send(res, 200, await service.get(actor, id));
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
      : message === 'estimate_not_found' ? 404
      : message === 'request_too_large' ? 413
      : 400;
    return send(res, status, { error: message });
  }
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, '0.0.0.0', () => {
  console.log(`elite-estimating listening on ${port}`);
});
