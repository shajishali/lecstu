import { Response } from 'express';
import prisma from '../config/database';

export type NotificationTypeEnum =
  | 'APPOINTMENT_REQUEST'
  | 'APPOINTMENT_ACCEPTED'
  | 'APPOINTMENT_REJECTED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_REMINDER'
  | 'APPOINTMENT_ADMIN_APPROVED'
  | 'APPOINTMENT_ADMIN_REJECTED'
  | 'HALL_BOOKING_REQUEST'
  | 'HALL_BOOKING_APPROVED'
  | 'HALL_BOOKING_REJECTED'
  | 'TIMETABLE_CHANGE'
  | 'ANNOUNCEMENT'
  | 'LECTURE_REMINDER';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationTypeEnum;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates a notification in the DB and pushes it to any connected SSE clients for that user.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, metadata } = params;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: type as any,
      title,
      message,
      metadata: metadata ? (metadata as object) : undefined,
    },
  });

  // Push to connected SSE clients
  pushToUser(userId, notification);
  return notification;
}

// ─────────────────────────────────────────
// SSE: Push to connected clients
// ─────────────────────────────────────────

type SSEClient = { res: Response; lastId: string };

const sseClients = new Map<string, SSEClient[]>();

export function registerSSEClient(userId: string, res: Response): void {
  const clients = sseClients.get(userId) || [];
  clients.push({ res, lastId: '' });
  sseClients.set(userId, clients);
}

export function unregisterSSEClient(userId: string, res: Response): void {
  const clients = sseClients.get(userId) || [];
  const filtered = clients.filter((c) => c.res !== res);
  if (filtered.length === 0) {
    sseClients.delete(userId);
  } else {
    sseClients.set(userId, filtered);
  }
}

function pushToUser(userId: string, notification: { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: Date; metadata: unknown }) {
  const clients = sseClients.get(userId) || [];
  const data = JSON.stringify({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    metadata: notification.metadata,
  });

  const keep: SSEClient[] = [];
  for (const client of clients) {
    try {
      client.res.write(`data: ${data}\n\n`);
      keep.push(client);
    } catch {
      // Client disconnected, skip
    }
  }
  if (keep.length > 0) {
    sseClients.set(userId, keep);
  } else {
    sseClients.delete(userId);
  }
}

/**
 * Notify affected students and lecturers when timetable is updated.
 * groupIds: unique group IDs from the timetable entries that were created/updated/deleted.
 */
export async function notifyTimetableChange(groupIds: string[]): Promise<void> {
  if (groupIds.length === 0) return;

  const title = 'Timetable Updated';
  const message = 'Your timetable has been updated. Please check your schedule.';

  // Students in affected groups
  const members = await prisma.studentGroupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { studentId: true },
    distinct: ['studentId'],
  });
  const studentIds = [...new Set(members.map((m) => m.studentId))];

  // Lecturers with entries in affected groups
  const entries = await prisma.masterTimetable.findMany({
    where: { groupId: { in: groupIds } },
    select: { lecturerId: true },
    distinct: ['lecturerId'],
  });
  const lecturerIds = [...new Set(entries.map((e) => e.lecturerId).filter(Boolean))];

  const userIds = [...new Set([...studentIds, ...lecturerIds])];
  for (const userId of userIds) {
    await createNotification({
      userId,
      type: 'TIMETABLE_CHANGE',
      title,
      message,
      metadata: { groupIds },
    });
  }
}

/**
 * Notify ALL students and lecturers (e.g. after bulk import).
 * Use when groups may be new and have no members yet.
 */
export async function notifyTimetableChangeBroadcast(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: { in: ['STUDENT', 'LECTURER'] }, isActive: true },
    select: { id: true },
  });
  const title = 'Timetable Updated';
  const message = 'The timetable has been updated. Please check your schedule.';

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: 'TIMETABLE_CHANGE',
      title,
      message,
      metadata: { broadcast: true },
    });
  }
}
