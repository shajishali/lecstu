import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import type { NotificationType } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';
import {
  registerSSEClient,
  unregisterSSEClient,
} from '../services/notificationService';

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { limit = 50, page = 1 } = req.query;

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
    const take = Math.min(100, Math.max(1, Number(limit)));

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: Math.max(1, Number(page)),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    next(err);
  }
}

const APPOINTMENT_NOTIFICATION_TYPES = [
  'APPOINTMENT_ACCEPTED',
  'APPOINTMENT_REJECTED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_ADMIN_APPROVED',
  'APPOINTMENT_ADMIN_REJECTED',
  'HALL_BOOKING_APPROVED',
  'HALL_BOOKING_REJECTED',
] as const;

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const types = req.query.types as string | undefined;

    const where: { userId: string; isRead: boolean; type?: { in: NotificationType[] } } = {
      userId,
      isRead: false,
    };
    if (types) {
      const typeList = types.split(',').map((t) => t.trim()).filter(Boolean);
      if (typeList.length > 0) {
        where.type = { in: typeList as NotificationType[] };
      }
    }

    const count = await prisma.notification.count({ where });

    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
}

export async function markAppointmentNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        type: { in: [...APPOINTMENT_NOTIFICATION_TYPES] },
      },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'Appointment notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new AppError('Notification not found', 404);
    if (notification.userId !== userId) throw new AppError('Access denied', 403);

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new AppError('Notification not found', 404);
    if (notification.userId !== userId) throw new AppError('Access denied', 403);

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
}

export async function streamNotifications(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  registerSSEClient(userId, res);

  req.on('close', () => {
    unregisterSSEClient(userId, res);
  });
}
