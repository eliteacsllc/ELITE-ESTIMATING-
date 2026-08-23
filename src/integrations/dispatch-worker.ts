import { PostgresLifecycleOutbox } from './outbox.js';
import { dispatchOutbox } from './dispatcher.js';

const databaseUrl = process.env.DATABASE_URL;
const endpoint = process.env.ELITE_CLAIMS_WEBHOOK_URL;
const secret = process.env.ELITE_CLAIMS_WEBHOOK_SECRET;

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!endpoint) throw new Error('ELITE_CLAIMS_WEBHOOK_URL is required');
if (!secret || secret.length < 32) throw new Error('ELITE_CLAIMS_WEBHOOK_SECRET must be at least 32 characters');

const outbox = new PostgresLifecycleOutbox(databaseUrl);
try {
  const result = await dispatchOutbox(outbox, { endpoint, secret });
  console.log(JSON.stringify(result));
  if (result.failed > 0) process.exitCode = 2;
} finally {
  await outbox.close();
}
