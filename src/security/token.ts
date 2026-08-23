import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Principal, Role } from './rbac.js';

type TokenClaims = Principal & { exp: number; iat?: number; iss?: string; aud?: string };

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export function verifyHs256Token(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): TokenClaims {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('invalid_token_format');
  const header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8')) as { alg?: string; typ?: string };
  if (header.alg !== 'HS256') throw new Error('unsupported_token_algorithm');

  const input = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac('sha256', secret).update(input).digest();
  const actual = decodeBase64Url(encodedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('invalid_token_signature');

  const claims = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8')) as Partial<TokenClaims>;
  if (!claims.userId || !claims.tenantId || !Array.isArray(claims.roles) || typeof claims.exp !== 'number') {
    throw new Error('invalid_token_claims');
  }
  if (claims.exp <= nowSeconds) throw new Error('token_expired');
  const allowedRoles = new Set<Role>(['platform_admin','tenant_admin','estimator','reviewer','carrier','appraiser','read_only']);
  if (!claims.roles.every((role) => allowedRoles.has(role as Role))) throw new Error('invalid_token_role');
  return claims as TokenClaims;
}
