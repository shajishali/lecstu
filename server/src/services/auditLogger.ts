import type { Request } from 'express';
import prisma from '../config/database';
import type { TokenPayload } from '../utils/jwt';

/** JWT payload uses `userId`, not `id`. */
export function userIdFromRequest(req: { user?: TokenPayload & { id?: string } }): string | undefined {
  const u = req.user;
  if (!u) return undefined;
  return u.userId ?? u.id;
}

export async function logAction(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  if (!userId) {
    console.warn(`[AuditLog] Skipped ${action} on ${entity}: missing userId`);
    return;
  }
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId, details: details ?? undefined },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AuditLog] Failed to log: ${action} on ${entity} — ${msg}`);
  }
}

export async function logActionForRequest(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const userId = userIdFromRequest(req);
  if (!userId) {
    console.warn(`[AuditLog] Skipped ${action} on ${entity}: not authenticated`);
    return;
  }
  await logAction(userId, action, entity, entityId, details);
}
