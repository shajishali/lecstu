import 'dotenv/config';
import pg from 'pg';
import { formatDatabaseError } from '../src/utils/databaseConnection';

function parseDatabaseUrl(url: string): { host: string; port: number; database: string } {
  const match = url.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
  return {
    host: match?.[1] ?? 'localhost',
    port: match?.[2] ? parseInt(match[2], 10) : 5432,
    database: match?.[3] ?? 'lecstu',
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[LECSTU] DATABASE_URL is not set in server/.env');
    process.exit(1);
  }

  const { host, port, database } = parseDatabaseUrl(url);
  console.log(`[LECSTU] Checking ${host}:${port}/${database} ...`);

  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query('SELECT 1');
    console.log('[LECSTU] Database connection OK');
  } catch (err) {
    console.error('[LECSTU] Database connection failed:', formatDatabaseError(err));
    if ((err as { code?: string }).code === 'ECONNREFUSED') {
      console.error(`[LECSTU] Start the PostgreSQL service for port ${port} (services.msc), or run: npm run db:start`);
    }
    process.exit(1);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

void main();
