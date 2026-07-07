import prisma from '../config/database';

const DEFAULT_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

export function formatDatabaseError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'ECONNREFUSED') {
    return (
      'PostgreSQL is not running on the host/port in DATABASE_URL. ' +
      'From repo root run: npm run db:start - or start the postgresql Windows service, then restart the server.'
    );
  }
  if (code === 'ENOTFOUND') {
    return 'Database host not found. Check DATABASE_URL in server/.env';
  }
  if (code === '28P01') {
    return 'Database login failed. Check username/password in DATABASE_URL (server/.env)';
  }
  if (code === '3D000') {
    return 'Database does not exist. Run: cd server && npm run db:migrate';
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Retry until PostgreSQL accepts connections (dev-friendly daily startup). */
export async function waitForDatabase(options?: {
  retries?: number;
  delayMs?: number;
}): Promise<boolean> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const delayMs = options?.delayMs ?? RETRY_DELAY_MS;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (attempt > 0) {
        console.log(`[LECSTU] Database connected (attempt ${attempt + 1})`);
      }
      return true;
    } catch (err) {
      if (attempt === 0) {
        console.log('[LECSTU] Waiting for PostgreSQL...');
      }
      if (attempt === retries - 1) {
        console.error(`[LECSTU] Database unavailable: ${formatDatabaseError(err)}`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
