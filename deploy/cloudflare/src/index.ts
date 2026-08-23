import { Container, getRandom } from '@cloudflare/containers';

interface Env {
  ELITE_ESTIMATING: DurableObjectNamespace<EliteEstimatingContainer>;
  PORT: string;
  ELITE_ALLOW_EPHEMERAL: string;
  ELITE_REQUIRE_IDEMPOTENCY: string;
  ELITE_REQUIRE_RATE_LIMIT: string;
  ELITE_RATE_LIMIT_CAPACITY: string;
  ELITE_RATE_LIMIT_REFILL_PER_SECOND: string;
  ELITE_REQUIRE_BLOB_STORAGE: string;
  ELITE_OUTBOX_MAX_PENDING: string;
  ELITE_OUTBOX_MAX_AGE_SECONDS: string;
  ELITE_OUTBOX_MAX_EXHAUSTED: string;
  DATABASE_URL: string;
  ELITE_AUTH_SECRET?: string;
  ELITE_METRICS_TOKEN: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  ELITE_CLAIMS_WEBHOOK_URL: string;
  ELITE_CLAIMS_WEBHOOK_SECRET: string;
  ELITE_OIDC_ISSUER?: string;
  ELITE_OIDC_AUDIENCE?: string;
  ELITE_OIDC_JWKS_URL?: string;
  ELITE_OIDC_TENANT_CLAIM?: string;
  ELITE_OIDC_ROLES_CLAIM?: string;
}

function runtimeEnv(env: Env): Record<string, string> {
  const required: Record<string, string> = {
    PORT: env.PORT,
    ELITE_ALLOW_EPHEMERAL: env.ELITE_ALLOW_EPHEMERAL,
    ELITE_REQUIRE_IDEMPOTENCY: env.ELITE_REQUIRE_IDEMPOTENCY,
    ELITE_REQUIRE_RATE_LIMIT: env.ELITE_REQUIRE_RATE_LIMIT,
    ELITE_RATE_LIMIT_CAPACITY: env.ELITE_RATE_LIMIT_CAPACITY,
    ELITE_RATE_LIMIT_REFILL_PER_SECOND: env.ELITE_RATE_LIMIT_REFILL_PER_SECOND,
    ELITE_REQUIRE_BLOB_STORAGE: env.ELITE_REQUIRE_BLOB_STORAGE,
    ELITE_OUTBOX_MAX_PENDING: env.ELITE_OUTBOX_MAX_PENDING,
    ELITE_OUTBOX_MAX_AGE_SECONDS: env.ELITE_OUTBOX_MAX_AGE_SECONDS,
    ELITE_OUTBOX_MAX_EXHAUSTED: env.ELITE_OUTBOX_MAX_EXHAUSTED,
    DATABASE_URL: env.DATABASE_URL,
    ELITE_METRICS_TOKEN: env.ELITE_METRICS_TOKEN,
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_BUCKET: env.R2_BUCKET,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    ELITE_CLAIMS_WEBHOOK_URL: env.ELITE_CLAIMS_WEBHOOK_URL,
    ELITE_CLAIMS_WEBHOOK_SECRET: env.ELITE_CLAIMS_WEBHOOK_SECRET,
  };
  const optional = {
    ELITE_AUTH_SECRET: env.ELITE_AUTH_SECRET,
    ELITE_OIDC_ISSUER: env.ELITE_OIDC_ISSUER,
    ELITE_OIDC_AUDIENCE: env.ELITE_OIDC_AUDIENCE,
    ELITE_OIDC_JWKS_URL: env.ELITE_OIDC_JWKS_URL,
    ELITE_OIDC_TENANT_CLAIM: env.ELITE_OIDC_TENANT_CLAIM,
    ELITE_OIDC_ROLES_CLAIM: env.ELITE_OIDC_ROLES_CLAIM,
  };
  for (const [key, value] of Object.entries(optional)) if (value) required[key] = value;
  return required;
}

export class EliteEstimatingContainer extends Container {
  defaultPort = 8787;
  requiredPorts = [8787];
  sleepAfter = '30m';
  enableInternet = true;
}

const INSTANCE_COUNT = 2;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = await getRandom(env.ELITE_ESTIMATING, INSTANCE_COUNT);
    await container.startAndWaitForPorts({
      ports: [8787],
      startOptions: { envVars: runtimeEnv(env), enableInternet: true },
      cancellationOptions: { portReadyTimeoutMS: 30_000 },
    });
    return container.fetch(request);
  },
};
