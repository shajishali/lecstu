import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { validateHallBooking } from '../services/hallBookingService';
import { createNotification } from '../services/notificationService';

const HALL_BOOKING_SELECT = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  reason: true,
  status: true,
  doorPassword: true,
  createdAt: true,
  studentId: true,
  hallId: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  hall: {
    select: {
      id: true,
      name: true,
      building: true,
      floor: true,
      capacity: true,
    },
  },
};

/** Notify all admins */
async function notifyAdmins(params: {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: params.type as any,
      title: params.title,
      message: params.message,
      metadata: params.metadata,
    });
  }
}

export async function createHallBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { hallId, date, startTime, endTime, reason } = req.body;

    if (!hallId || !date || !startTime || !endTime) {
      throw new AppError('hallId, date, startTime, and endTime are required', 400);
    }

    const bookingDate = new Date(date);
    await validateHallBooking(hallId, bookingDate, startTime, endTime);

    const booking = await prisma.hallBooking.create({
      data: {
        studentId: userId,
        hallId,
        date: bookingDate,
        startTime: String(startTime).trim(),
        endTime: String(endTime).trim(),
        reason: reason || null,
      },
      select: HALL_BOOKING_SELECT,
    });

    const studentName = `${booking.student.firstName} ${booking.student.lastName}`;
    const hallName = booking.hall.name;
    const dateStr = bookingDate.toLocaleDateString();
    await notifyAdmins({
      type: 'HALL_BOOKING_REQUEST',
      title: 'New hall booking request',
      message: `${studentName} requested to book ${hallName} on ${dateStr} at ${startTime}–${endTime}${reason ? `: ${reason}` : ''}`,
      metadata: { hallBookingId: booking.id },
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

export async function listHallBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { status, limit = 50, page = 1 } = req.query;

    const where: any = {};
    if (role === 'STUDENT') {
      where.studentId = userId;
    } else if (role !== 'ADMIN') {
      where.studentId = userId; // non-admin non-student shouldn't see others
    }

    if (status && typeof status === 'string') {
      const statuses = status.split(',').map((s) => s.trim().toUpperCase());
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
    const take = Math.min(100, Math.max(1, Number(limit)));

    const isAdminPending =
      role === 'ADMIN' &&
      status &&
      typeof status === 'string' &&
      status.split(',').map((s) => s.trim().toUpperCase()).includes('PENDING');

    const [bookings, total] = await Promise.all([
      prisma.hallBooking.findMany({
        where,
        select: HALL_BOOKING_SELECT,
        orderBy: isAdminPending
          ? [{ createdAt: 'desc' }]
          : [{ date: 'asc' }, { startTime: 'asc' }],
        skip,
        take,
      }),
      prisma.hallBooking.count({ where }),
    ]);

    res.json({
      success: true,
      data: bookings,
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

export async function getHallBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const id = req.params.id as string;

    const booking = await prisma.hallBooking.findUnique({
      where: { id },
      select: HALL_BOOKING_SELECT,
    });

    if (!booking) throw new AppError('Hall booking not found', 404);

    const canAccess =
      role === 'ADMIN' || booking.studentId === userId;
    if (!canAccess) throw new AppError('Access denied', 403);

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

function formatTimeForDisplay(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

export async function approveHallBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { doorPassword } = req.body || {};

    const booking = await prisma.hallBooking.findUnique({
      where: { id },
      select: HALL_BOOKING_SELECT,
    });

    if (!booking) throw new AppError('Hall booking not found', 404);
    if (booking.status !== 'PENDING') {
      throw new AppError('Only pending bookings can be approved', 400);
    }
    if (!doorPassword || typeof doorPassword !== 'string' || doorPassword.trim().length === 0) {
      throw new AppError('Door password is required when approving hall bookings', 400);
    }

    await validateHallBooking(
      booking.hallId,
      booking.date,
      booking.startTime,
      booking.endTime,
      id,
      { skipPastDateCheck: true }
    );

    const updated = await prisma.hallBooking.update({
      where: { id },
      data: { status: 'APPROVED', doorPassword: doorPassword.trim() },
      select: HALL_BOOKING_SELECT,
    });

    const dateStr = booking.date.toLocaleDateString();
    const timeStr = `${formatTimeForDisplay(booking.startTime)} – ${formatTimeForDisplay(booking.endTime)}`;
    const message = `Your booking of ${booking.hall.name} has been approved.\n\n📅 Date: ${dateStr}\n⏰ Allocated time: ${timeStr}\n🔑 Door password: ${doorPassword.trim()}\n\nUse this password at the automated door during your allocated time.`;
    await createNotification({
      userId: booking.studentId,
      type: 'HALL_BOOKING_APPROVED',
      title: 'Hall booking approved — door password included',
      message,
      metadata: {
        hallBookingId: updated.id,
        doorPassword: doorPassword.trim(),
        date: dateStr,
        startTime: booking.startTime,
        endTime: booking.endTime,
        hallName: booking.hall.name,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function rejectHallBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { reason } = req.body || {};

    const booking = await prisma.hallBooking.findUnique({
      where: { id },
      select: HALL_BOOKING_SELECT,
    });

    if (!booking) throw new AppError('Hall booking not found', 404);
    if (booking.status !== 'PENDING') {
      throw new AppError('Only pending bookings can be rejected', 400);
    }

    const updated = await prisma.hallBooking.update({
      where: { id },
      data: { status: 'REJECTED' },
      select: HALL_BOOKING_SELECT,
    });

    const dateStr = booking.date.toLocaleDateString();
    await createNotification({
      userId: booking.studentId,
      type: 'HALL_BOOKING_REJECTED',
      title: 'Hall booking rejected',
      message: `Your booking of ${booking.hall.name} on ${dateStr} at ${booking.startTime}–${booking.endTime} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
      metadata: { hallBookingId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelHallBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { reason } = req.body || {};

    const booking = await prisma.hallBooking.findUnique({
      where: { id },
      select: HALL_BOOKING_SELECT,
    });

    if (!booking) throw new AppError('Hall booking not found', 404);
    if (booking.studentId !== userId) throw new AppError('Access denied', 403);
    if (!['PENDING', 'APPROVED'].includes(booking.status)) {
      throw new AppError('Only pending or approved bookings can be cancelled', 400);
    }

    const updated = await prisma.hallBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: HALL_BOOKING_SELECT,
    });

    const studentName = `${booking.student.firstName} ${booking.student.lastName}`;
    const dateStr = booking.date.toLocaleDateString();
    await notifyAdmins({
      type: 'HALL_BOOKING_REQUEST',
      title: 'Hall booking cancelled by student',
      message: `${studentName} cancelled their booking of ${booking.hall.name} on ${dateStr} at ${booking.startTime}–${booking.endTime}.${reason ? ` Reason: ${reason}` : ''}`,
      metadata: { hallBookingId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
