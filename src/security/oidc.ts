import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Principal, Role } from './rbac.js';

const allowedRoles = new Set<Role>(['platform_admin','tenant_admin','estimator','reviewer','carrier','appraiser','read_only']);

export type OidcConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
  tenantClaim: string;
  rolesClaim: string;
};

export function oidcConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OidcConfig | null {
  const issuer = env.ELITE_OIDC_ISSUER?.trim();
  const audience = env.ELITE_OIDC_AUDIENCE?.trim();
  const jwksUrl = env.ELITE_OIDC_JWKS_URL?.trim();
  if (!issuer && !audience && !jwksUrl) return null;
  if (!issuer || !audience || !jwksUrl) throw new Error('oidc_configuration_incomplete');
  const issuerUrl = new URL(issuer);
  const keysUrl = new URL(jwksUrl);
  if (issuerUrl.protocol !== 'https:' || keysUrl.protocol !== 'https:') throw new Error('oidc_requires_https');
  return {
    issuer: issuerUrl.toString().replace(/\/$/, ''),
    audience,
    jwksUrl: keysUrl.toString(),
    tenantClaim: env.ELITE_OIDC_TENANT_CLAIM?.trim() || 'tenant_id',
    rolesClaim: env.ELITE_OIDC_ROLES_CLAIM?.trim() || 'roles',
  };
}

function stringClaim(payload: JWTPayload, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`oidc_missing_claim:${name}`);
  return value.trim();
}

function rolesClaim(payload: JWTPayload, name: string): Role[] {
  const value = payload[name];
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[ ,]+/) : [];
  const roles = raw.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()).filter(Boolean);
  const accepted = roles.filter((role): role is Role => allowedRoles.has(role as Role));
  if (accepted.length === 0) throw new Error('oidc_no_supported_roles');
  return [...new Set(accepted)];
}

export class OidcPrincipalVerifier {
  private readonly jwks;
  constructor(private readonly config: OidcConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 5_000, cooldownDuration: 30_000 });
  }

  async verify(token: string): Promise<Principal> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithms: ['RS256','RS384','RS512','PS256','PS384','PS512','ES256','ES384','ES512','EdDSA'],
      clockTolerance: 5,
    });
    if (!payload.sub) throw new Error('oidc_missing_subject');
    return {
      userId: payload.sub,
      tenantId: stringClaim(payload, this.config.tenantClaim),
      roles: rolesClaim(payload, this.config.rolesClaim),
    };
  }
}
