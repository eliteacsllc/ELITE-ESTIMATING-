import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for migrations');

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const dir = resolve(process.cwd(), 'migrations');
  const files = (await readdir(dir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const filename of files) {
    const found = await pool.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [filename]);
    if (found.rowCount) continue;
    const sql = await readFile(resolve(dir, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [filename]);
      await client.query('COMMIT');
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
