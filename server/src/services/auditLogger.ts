import prisma from '../config/database';

export async function logAction(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entity, entityId, details: details ?? undefined },
    });
  } catch {
    console.error(`[AuditLog] Failed to log: ${action} on ${entity}`);
  }
}
